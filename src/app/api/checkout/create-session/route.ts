import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";
import { getNightlyRates } from "@/lib/pricelabs/client";
import { getQuote } from "@/lib/lodgify/client";
import { validateTimingUpsellPrices } from "@/lib/upsells/timing";

const PA_STATE_TAX_RATE = 0.06;
const MONROE_COUNTY_TAX_RATE = 0.03;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

async function getLodgifyRoomId(lodgifyPropertyId: number): Promise<number | null> {
  const res = await fetch(`https://api.lodgify.com/v2/properties/${lodgifyPropertyId}/rooms`, {
    headers: { "X-ApiKey": process.env.LODGIFY_API_KEY!, Accept: "application/json" },
  });
  if (!res.ok) return null;
  const rooms = (await res.json()) as { id: number }[];
  return rooms[0]?.id ?? null;
}

type UpsellItem = {
  type: string;
  label: string;
  price_cents: number;
  meta?: Record<string, unknown>;
};

export async function POST(request: Request) {
  const body = await request.json();
  const {
    property_id,
    check_in,
    check_out,
    guests,
    pets,
    guest_name,
    guest_email,
    guest_phone,
    upsells,
    promo_code,
  } = body as {
    property_id: string;
    check_in: string;
    check_out: string;
    guests: number;
    pets: number;
    guest_name: string;
    guest_email: string;
    guest_phone: string;
    upsells: UpsellItem[];
    promo_code?: string;
  };

  if (!property_id || !check_in || !check_out || !guest_name || !guest_email) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (pets > 3) {
    return NextResponse.json({ error: "Maximum 3 pets allowed" }, { status: 400 });
  }

  // Enforce authoritative server-side pricing for timing upsells (holiday surcharge).
  const priceError = validateTimingUpsellPrices(upsells || [], check_in, check_out);
  if (priceError) {
    return NextResponse.json({ error: priceError }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Load property
  const { data: property } = await supabase
    .from("property")
    .select("id, name, slug, lodgify_property_id, guest_cleaning_fee_cents, guest_pet_fee_cents")
    .eq("id", property_id)
    .single();

  if (!property || !property.lodgify_property_id) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  // Fetch nightly rates
  const roomId = await getLodgifyRoomId(property.lodgify_property_id);
  let nightlyRates: { date: string; price_cents: number; min_stay: number }[] = [];
  const nights = Math.round(
    (new Date(check_out + "T00:00:00").getTime() - new Date(check_in + "T00:00:00").getTime()) /
      (1000 * 60 * 60 * 24)
  );

  if (roomId) {
    try {
      nightlyRates = await getNightlyRates(property.lodgify_property_id, roomId, check_in, check_out);
    } catch {
      // Fallback to Lodgify quote
      const quote = await getQuote(property.lodgify_property_id, check_in, check_out, guests);
      if (quote) {
        const avgNightly = Math.round(Math.round(quote.total * 100) / nights);
        const d = new Date(check_in + "T00:00:00");
        for (let i = 0; i < nights; i++) {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          nightlyRates.push({ date: `${y}-${m}-${day}`, price_cents: avgNightly, min_stay: 1 });
          d.setDate(d.getDate() + 1);
        }
      }
    }
  }

  if (nightlyRates.length === 0) {
    return NextResponse.json({ error: "Unable to fetch pricing" }, { status: 502 });
  }

  // Calculate totals
  const roomRateCents = nightlyRates.reduce((sum, r) => sum + r.price_cents, 0);
  const cleaningFeeCents = property.guest_cleaning_fee_cents || 0;
  const petFeeCents = property.guest_pet_fee_cents || 0;
  const petFeeTotalCents = pets * petFeeCents;
  const stateTaxCents = Math.round(roomRateCents * PA_STATE_TAX_RATE);
  const countyTaxCents = Math.round(roomRateCents * MONROE_COUNTY_TAX_RATE);
  const taxTotalCents = stateTaxCents + countyTaxCents;
  const upsellTotalCents = (upsells || []).reduce((sum, u) => sum + u.price_cents, 0);

  // Validate promo code
  let promoCodeId: string | null = null;
  let discountCents = 0;

  if (promo_code) {
    const { data: promo } = await supabase
      .from("promo_code")
      .select("*")
      .ilike("code", promo_code)
      .eq("is_active", true)
      .maybeSingle();

    if (promo) {
      const now = new Date();
      const valid =
        (!promo.valid_from || new Date(promo.valid_from) <= now) &&
        (!promo.valid_until || new Date(promo.valid_until) >= now) &&
        (promo.max_uses === null || promo.times_used < promo.max_uses) &&
        nights >= promo.min_nights &&
        (!promo.property_id || promo.property_id === property_id);

      if (valid) {
        promoCodeId = promo.id;
        switch (promo.discount_type) {
          case "percentage":
            discountCents = Math.round(roomRateCents * promo.discount_value / 100);
            break;
          case "flat":
            discountCents = promo.discount_value;
            break;
          case "free_nights": {
            const avgNightly = Math.round(roomRateCents / nights);
            discountCents = avgNightly * Math.min(promo.discount_value, nights);
            break;
          }
          case "free_cleaning":
            discountCents = cleaningFeeCents;
            break;
        }
        discountCents = Math.min(discountCents, roomRateCents + cleaningFeeCents);
      }
    }
  }

  const totalCents = roomRateCents + cleaningFeeCents + petFeeTotalCents + taxTotalCents + upsellTotalCents - discountCents;

  // Create guest
  const { data: existingGuest } = await supabase
    .from("guest")
    .select("id")
    .eq("email", guest_email)
    .maybeSingle();

  let guestId: string;
  if (existingGuest) {
    guestId = existingGuest.id;
    await supabase
      .from("guest")
      .update({ full_name: guest_name, phone: guest_phone || null })
      .eq("id", guestId);
  } else {
    const { data: newGuest, error: guestErr } = await supabase
      .from("guest")
      .insert({ full_name: guest_name, email: guest_email, phone: guest_phone || null })
      .select("id")
      .single();
    if (guestErr || !newGuest) {
      return NextResponse.json({ error: "Failed to create guest" }, { status: 500 });
    }
    guestId = newGuest.id;
  }

  // Create registration with pending_payment status
  const { data: registration, error: regErr } = await supabase
    .from("registration")
    .insert({
      property_id,
      guest_id: guestId,
      check_in_date: check_in,
      check_out_date: check_out,
      num_guests: guests,
      lodgify_num_pets: pets,
      status: "pending_payment",
      booking_source: "direct",
      total_amount_cents: totalCents,
      promo_code_id: promoCodeId,
      discount_cents: discountCents,
      cleaning_fee_cents: cleaningFeeCents,
      tax_amount_cents: taxTotalCents,
      pet_fee_total_cents: petFeeTotalCents,
      nightly_rates_snapshot: nightlyRates,
      upsells: (upsells || []).map((u) => ({
        type: u.type,
        label: u.label,
        price_cents: u.price_cents,
        status: "pending",
        meta: u.meta || null,
      })),
    })
    .select("id")
    .single();

  if (regErr || !registration) {
    console.error("[checkout/create-session] Registration insert failed:", regErr);
    return NextResponse.json({ error: "Failed to create registration", details: regErr?.message }, { status: 500 });
  }

  // Build Stripe line items
  const lineItems: { price_data: { currency: string; product_data: { name: string }; unit_amount: number }; quantity: number }[] = [];

  // Nightly rates
  for (const rate of nightlyRates) {
    const dateLabel = new Date(rate.date + "T00:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: { name: `Nightly Rate — ${dateLabel}` },
        unit_amount: rate.price_cents,
      },
      quantity: 1,
    });
  }

  // Cleaning fee
  if (cleaningFeeCents > 0) {
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: { name: "Cleaning Fee" },
        unit_amount: cleaningFeeCents,
      },
      quantity: 1,
    });
  }

  // Pet fees
  if (pets > 0 && petFeeCents > 0) {
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: { name: "Pet Fee" },
        unit_amount: petFeeCents,
      },
      quantity: pets,
    });
  }

  // Taxes
  if (stateTaxCents > 0) {
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: { name: "PA State Hotel Occupancy Tax (6%)" },
        unit_amount: stateTaxCents,
      },
      quantity: 1,
    });
  }
  if (countyTaxCents > 0) {
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: { name: "Monroe County Hotel Occupancy Tax (3%)" },
        unit_amount: countyTaxCents,
      },
      quantity: 1,
    });
  }

  // Upsells
  for (const upsell of upsells || []) {
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: { name: upsell.label },
        unit_amount: upsell.price_cents,
      },
      quantity: 1,
    });
  }

  // Promo discount coupon
  let discounts: { coupon: string }[] | undefined;
  if (discountCents > 0) {
    const coupon = await stripe.coupons.create({
      amount_off: discountCents,
      currency: "usd",
      max_redemptions: 1,
      redeem_by: Math.floor(Date.now() / 1000) + 86400, // expires in 24h
    });
    discounts = [{ coupon: coupon.id }];
  }

  // Create Stripe session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: lineItems,
    mode: "payment",
    discounts,
    customer_email: guest_email,
    success_url: `${APP_URL}/book/${property.slug}/checkout?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL}/book/${property.slug}/checkout?check_in=${check_in}&check_out=${check_out}&guests=${guests}&pets=${pets}`,
    metadata: {
      booking_type: "booking",
      registration_id: registration.id,
      property_id,
      guest_id: guestId,
      promo_code_id: promoCodeId || "",
    },
    expires_at: Math.floor(Date.now() / 1000) + 1800, // 30 minutes
  });

  // Create pending payment record
  await supabase.from("payment").insert({
    registration_id: registration.id,
    guest_id: guestId,
    stripe_checkout_session_id: session.id,
    amount_cents: totalCents,
    currency: "usd",
    status: "pending",
    booking_type: "booking",
  });

  return NextResponse.json({
    url: session.url,
    registration_id: registration.id,
  });
}
