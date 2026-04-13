import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function POST(request: Request) {
  const { registration_id } = (await request.json()) as { registration_id: string };

  if (!registration_id) {
    return NextResponse.json({ error: "registration_id required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Load registration with guest and property
  const { data: reg } = await supabase
    .from("registration")
    .select("*, guest:guest_id(email, full_name), property:property_id(slug, name, cleaning_fee_cents, pet_fee_cents)")
    .eq("id", registration_id)
    .single();

  if (!reg) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 });
  }

  const guest = reg.guest as unknown as { email: string; full_name: string } | null;
  const prop = reg.property as unknown as { slug: string; name: string; cleaning_fee_cents: number; pet_fee_cents: number } | null;

  if (!guest || !prop) {
    return NextResponse.json({ error: "Missing guest or property data" }, { status: 400 });
  }

  // Rebuild line items from snapshot
  const nightlyRates = (reg.nightly_rates_snapshot || []) as { date: string; price_cents: number }[];
  const lineItems: { price_data: { currency: string; product_data: { name: string }; unit_amount: number }; quantity: number }[] = [];

  for (const rate of nightlyRates) {
    const dateLabel = new Date(rate.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
    lineItems.push({
      price_data: { currency: "usd", product_data: { name: `Nightly Rate — ${dateLabel}` }, unit_amount: rate.price_cents },
      quantity: 1,
    });
  }

  if (reg.cleaning_fee_cents > 0) {
    lineItems.push({
      price_data: { currency: "usd", product_data: { name: "Cleaning Fee" }, unit_amount: reg.cleaning_fee_cents },
      quantity: 1,
    });
  }

  if (reg.pet_fee_total_cents > 0) {
    lineItems.push({
      price_data: { currency: "usd", product_data: { name: "Pet Fee" }, unit_amount: reg.pet_fee_total_cents },
      quantity: 1,
    });
  }

  if (reg.tax_amount_cents > 0) {
    lineItems.push({
      price_data: { currency: "usd", product_data: { name: "Occupancy Tax (9%)" }, unit_amount: reg.tax_amount_cents },
      quantity: 1,
    });
  }

  // Add upsells
  for (const upsell of (reg.upsells || []) as { label: string; price_cents: number }[]) {
    lineItems.push({
      price_data: { currency: "usd", product_data: { name: upsell.label }, unit_amount: upsell.price_cents },
      quantity: 1,
    });
  }

  // Promo discount
  let discounts: { coupon: string }[] | undefined;
  if (reg.discount_cents > 0) {
    const coupon = await stripe.coupons.create({
      amount_off: reg.discount_cents,
      currency: "usd",
      max_redemptions: 1,
      redeem_by: Math.floor(Date.now() / 1000) + 86400 * 7, // 7 days
    });
    discounts = [{ coupon: coupon.id }];
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: lineItems,
    mode: "payment",
    discounts,
    customer_email: guest.email,
    success_url: `${APP_URL}/book/${prop.slug}/checkout?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL}/book/${prop.slug}`,
    metadata: {
      booking_type: "booking",
      registration_id,
      property_id: reg.property_id,
      guest_id: reg.guest_id,
      promo_code_id: reg.promo_code_id || "",
    },
  });

  // Update payment record
  await supabase
    .from("payment")
    .update({ stripe_checkout_session_id: session.id, status: "pending" })
    .eq("registration_id", registration_id)
    .in("status", ["failed", "pending"]);

  return NextResponse.json({ checkout_url: session.url });
}
