import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";
import { getNightlyRates } from "@/lib/pricelabs/client";
import { getQuote } from "@/lib/lodgify/client";
import { validateTimingUpsellPrices } from "@/lib/upsells/timing";
import { fetchCandidatePromos, buildGuestUsageById } from "@/lib/promo/candidates";
import { resolvePromos } from "@/lib/promo/resolve";

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

  // Enforce the arrival night's minimum-stay rule (Lodgify keys min-stay to the
  // arrival date). Without this the site can take payment for a stay Lodgify
  // refuses to accept — it rejects sub-minimum reservations with error 902,
  // leaving the booking paid but impossible to sync to the calendar.
  const minStay = nightlyRates[0].min_stay || 1;
  if (nights < minStay) {
    return NextResponse.json(
      { error: `These dates require a minimum stay of ${minStay} nights. Please adjust your check-in or check-out date.` },
      { status: 400 }
    );
  }

  // Calculate totals
  const roomRateCents = nightlyRates.reduce((sum, r) => sum + r.price_cents, 0);
  const cleaningFeeCents = property.guest_cleaning_fee_cents || 0;
  const petFeeCents = property.guest_pet_fee_cents || 0;
  // Flat fee: one charge covers up to 3 pets (more than 3 is rejected above)
  const petFeeTotalCents = pets > 0 ? petFeeCents : 0;
  const stateTaxCents = Math.round(roomRateCents * PA_STATE_TAX_RATE);
  const countyTaxCents = Math.round(roomRateCents * MONROE_COUNTY_TAX_RATE);
  const taxTotalCents = stateTaxCents + countyTaxCents;
  const upsellTotalCents = (upsells || []).reduce((sum, u) => sum + u.price_cents, 0);

  // Resolve the guest first so guest_type / per-guest usage caps are authoritative.
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

  // Resolve promos (auto-apply + typed code) through the unified engine. This is
  // the authoritative pass — the checkout form's number is a display estimate.
  const [candidates, usage] = await Promise.all([
    fetchCandidatePromos(supabase, property_id, promo_code),
    buildGuestUsageById(supabase, guestId),
  ]);
  const promoResult = resolvePromos(
    {
      propertyId: property_id,
      nights,
      nightlyRates: nightlyRates.map((r) => ({ date: r.date, price_cents: r.price_cents })),
      roomRateCents,
      cleaningFeeCents,
      petFeeTotalCents,
      upsells: (upsells || []).map((u) => ({ type: u.type, price_cents: u.price_cents })),
      guests,
      checkInDate: check_in,
      checkOutDate: check_out,
      guestPriorCompletedStays: usage.priorStays,
      guestPromoUseCounts: usage.useCounts,
      now: new Date(),
    },
    candidates,
  );

  const promoCodeId = promoResult.primaryPromoId;
  const appliedPromoIds = promoResult.appliedPromoIds;
  // Upsell-targeted discounts come off their line items directly; the rest
  // (room/cleaning/pet) goes into the single Stripe coupon. Keep a mutable copy
  // so each adjustment is applied to exactly one line item.
  const upsellAdjustments: Record<string, number> = { ...promoResult.upsellAdjustments };
  let couponDiscountCents = promoResult.couponDiscountCents;
  const discountCents = promoResult.totalDiscountCents;

  const totalCents = roomRateCents + cleaningFeeCents + petFeeTotalCents + taxTotalCents + upsellTotalCents - discountCents;

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
      applied_promo_ids: appliedPromoIds,
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
      quantity: 1,
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

  // Upsells — apply any promo discount targeted at this add-on directly to its
  // line item (so it shows as e.g. "Firewood — $0.00"), then drop it from the
  // adjustment map so it's only applied once.
  for (const upsell of upsells || []) {
    const adj = upsellAdjustments[upsell.type] ?? 0;
    const unit = Math.max(0, upsell.price_cents - adj);
    if (adj > 0) upsellAdjustments[upsell.type] = 0;
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: { name: upsell.label },
        unit_amount: unit,
      },
      quantity: 1,
    });
  }

  // Keep a positive charge: Stripe rejects a $0 session. Trim the coupon so the
  // order stays at or above a $0.50 floor (full comps go through admin invoices).
  const orderBeforeCoupon =
    roomRateCents + cleaningFeeCents + petFeeTotalCents + taxTotalCents +
    (upsells || []).reduce((sum, u) => sum + Math.max(0, u.price_cents - (promoResult.upsellAdjustments[u.type] ?? 0)), 0);
  if (orderBeforeCoupon - couponDiscountCents < 50) {
    couponDiscountCents = Math.max(0, orderBeforeCoupon - 50);
  }

  // Promo discount coupon (room/cleaning/pet bucket only — upsell discounts are
  // already baked into the line items above).
  let discounts: { coupon: string }[] | undefined;
  if (couponDiscountCents > 0) {
    const coupon = await stripe.coupons.create({
      amount_off: couponDiscountCents,
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
      applied_promo_ids: appliedPromoIds.join(","),
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
