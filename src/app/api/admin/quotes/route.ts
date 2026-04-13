import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";
import { getNightlyRates } from "@/lib/pricelabs/client";
import { getQuote } from "@/lib/lodgify/client";

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

type UpsellItem = { type: string; label: string; price_cents: number; meta?: Record<string, unknown> };

export async function POST(request: Request) {
  const body = await request.json();
  const {
    property_id, check_in, check_out, guests, pets,
    guest_name, guest_email, upsells, promo_code, notes,
  } = body as {
    property_id: string; check_in: string; check_out: string;
    guests: number; pets: number; guest_name: string; guest_email: string;
    upsells?: UpsellItem[]; promo_code?: string; notes?: string;
  };

  if (!property_id || !check_in || !check_out || !guest_name || !guest_email) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = createAdminClient();

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
  const nights = Math.round(
    (new Date(check_out + "T00:00:00").getTime() - new Date(check_in + "T00:00:00").getTime()) / (1000 * 60 * 60 * 24)
  );

  let nightlyRates: { date: string; price_cents: number; min_stay: number }[] = [];

  if (roomId) {
    try {
      nightlyRates = await getNightlyRates(property.lodgify_property_id, roomId, check_in, check_out);
    } catch {
      const quote = await getQuote(property.lodgify_property_id, check_in, check_out, guests);
      if (quote) {
        const avg = Math.round(Math.round(quote.total * 100) / nights);
        const d = new Date(check_in + "T00:00:00");
        for (let i = 0; i < nights; i++) {
          nightlyRates.push({ date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`, price_cents: avg, min_stay: 1 });
          d.setDate(d.getDate() + 1);
        }
      }
    }
  }

  if (nightlyRates.length === 0) {
    return NextResponse.json({ error: "Unable to fetch pricing" }, { status: 502 });
  }

  const roomRateCents = nightlyRates.reduce((sum, r) => sum + r.price_cents, 0);
  const cleaningFeeCents = property.guest_cleaning_fee_cents || 0;
  const petFeeTotalCents = pets * (property.guest_pet_fee_cents || 0);
  const taxTotalCents = Math.round(roomRateCents * (PA_STATE_TAX_RATE + MONROE_COUNTY_TAX_RATE));
  const upsellTotalCents = (upsells || []).reduce((sum, u) => sum + u.price_cents, 0);

  // Promo
  let promoCodeId: string | null = null;
  let discountCents = 0;
  if (promo_code) {
    const { data: promo } = await supabase.from("promo_code").select("*").ilike("code", promo_code).eq("is_active", true).maybeSingle();
    if (promo) {
      promoCodeId = promo.id;
      switch (promo.discount_type) {
        case "percentage": discountCents = Math.round(roomRateCents * promo.discount_value / 100); break;
        case "flat": discountCents = promo.discount_value; break;
        case "free_nights": discountCents = Math.round(roomRateCents / nights) * Math.min(promo.discount_value, nights); break;
        case "free_cleaning": discountCents = cleaningFeeCents; break;
      }
      discountCents = Math.min(discountCents, roomRateCents + cleaningFeeCents);
    }
  }

  const totalCents = roomRateCents + cleaningFeeCents + petFeeTotalCents + taxTotalCents + upsellTotalCents - discountCents;

  // Create guest
  const { data: existingGuest } = await supabase.from("guest").select("id").eq("email", guest_email).maybeSingle();
  let guestId: string;
  if (existingGuest) {
    guestId = existingGuest.id;
  } else {
    const { data: newGuest } = await supabase.from("guest").insert({ full_name: guest_name, email: guest_email }).select("id").single();
    if (!newGuest) return NextResponse.json({ error: "Failed to create guest" }, { status: 500 });
    guestId = newGuest.id;
  }

  // Create registration as "quote"
  const { data: registration } = await supabase
    .from("registration")
    .insert({
      property_id, guest_id: guestId,
      check_in_date: check_in, check_out_date: check_out,
      num_guests: guests, lodgify_num_pets: pets,
      status: "quote", booking_source: "direct",
      total_amount_cents: totalCents,
      promo_code_id: promoCodeId, discount_cents: discountCents,
      cleaning_fee_cents: cleaningFeeCents, tax_amount_cents: taxTotalCents,
      pet_fee_total_cents: petFeeTotalCents,
      nightly_rates_snapshot: nightlyRates,
      notes: notes || null,
      upsells: (upsells || []).map((u) => ({ type: u.type, label: u.label, price_cents: u.price_cents, status: "pending", meta: u.meta || null })),
    })
    .select("id")
    .single();

  if (!registration) return NextResponse.json({ error: "Failed to create registration" }, { status: 500 });

  // Build Stripe line items
  const lineItems: { price_data: { currency: string; product_data: { name: string }; unit_amount: number }; quantity: number }[] = [];

  for (const rate of nightlyRates) {
    const lbl = new Date(rate.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
    lineItems.push({ price_data: { currency: "usd", product_data: { name: `Nightly Rate — ${lbl}` }, unit_amount: rate.price_cents }, quantity: 1 });
  }
  if (cleaningFeeCents > 0) lineItems.push({ price_data: { currency: "usd", product_data: { name: "Cleaning Fee" }, unit_amount: cleaningFeeCents }, quantity: 1 });
  if (petFeeTotalCents > 0) lineItems.push({ price_data: { currency: "usd", product_data: { name: "Pet Fee" }, unit_amount: petFeeTotalCents }, quantity: 1 });
  if (taxTotalCents > 0) lineItems.push({ price_data: { currency: "usd", product_data: { name: "Occupancy Tax (9%)" }, unit_amount: taxTotalCents }, quantity: 1 });
  for (const u of upsells || []) lineItems.push({ price_data: { currency: "usd", product_data: { name: u.label }, unit_amount: u.price_cents }, quantity: 1 });

  let discounts: { coupon: string }[] | undefined;
  if (discountCents > 0) {
    const coupon = await stripe.coupons.create({ amount_off: discountCents, currency: "usd", max_redemptions: 1, redeem_by: Math.floor(Date.now() / 1000) + 86400 * 30 });
    discounts = [{ coupon: coupon.id }];
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: lineItems,
    mode: "payment",
    discounts,
    customer_email: guest_email,
    success_url: `${APP_URL}/book/${property.slug}/checkout?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL}/book/${property.slug}`,
    metadata: { booking_type: "booking", registration_id: registration.id, property_id, guest_id: guestId, promo_code_id: promoCodeId || "" },
  });

  await supabase.from("payment").insert({
    registration_id: registration.id, guest_id: guestId,
    stripe_checkout_session_id: session.id, amount_cents: totalCents, currency: "usd", status: "pending", booking_type: "booking",
  });

  return NextResponse.json({ registration_id: registration.id, checkout_url: session.url });
}
