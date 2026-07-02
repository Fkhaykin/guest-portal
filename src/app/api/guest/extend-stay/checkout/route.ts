import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";
import { verifyGuestToken } from "@/lib/guest-token";
import { quoteExtension } from "@/lib/upsells/extend-stay";

// Create a Stripe Checkout session for a stay extension. Re-quotes server-side so
// the charged amount can't be tampered with, then records a pending extend_stay
// upsell carrying everything the fulfillment step needs.
export async function POST(request: Request) {
  let body: { registration_id: string; new_check_out_date: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { registration_id, new_check_out_date } = body;
  if (!registration_id || !new_check_out_date) {
    return NextResponse.json(
      { error: "registration_id and new_check_out_date are required" },
      { status: 400 }
    );
  }

  const token = request.headers.get("x-guest-token") || "";
  if (!verifyGuestToken(registration_id, token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Authoritative re-quote (also re-checks availability + split-pay guard).
  const result = await quoteExtension(admin, {
    registrationId: registration_id,
    newCheckOutDate: new_check_out_date,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  const q = result.quote;

  const { data: reg } = await admin
    .from("registration")
    .select("id, upsells, property_id")
    .eq("id", registration_id)
    .single();
  if (!reg) return NextResponse.json({ error: "Reservation not found" }, { status: 404 });

  const { data: property } = await admin
    .from("property")
    .select("slug")
    .eq("id", reg.property_id)
    .single();

  const host = request.headers.get("host") || "localhost:3000";
  const proto = request.headers.get("x-forwarded-proto") || "http";
  const appUrl = `${proto}://${host}`;
  const slug = property?.slug || "";

  const label = `Extended stay — ${q.extraNights} night${q.extraNights !== 1 ? "s" : ""} (checkout ${q.newCheckOutDate})`;

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: label },
          unit_amount: q.totalCents,
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `${appUrl}/p/${slug}/extend-stay?extend_success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/p/${slug}/extend-stay?extend_cancelled=true`,
    metadata: {
      registration_id,
      upsell_types: "extend_stay",
      new_check_out_date: q.newCheckOutDate,
      extra_nights: String(q.extraNights),
    },
  });

  const existingUpsells = (reg.upsells as Array<Record<string, unknown>>) || [];
  const newUpsell = {
    type: "extend_stay",
    label,
    price_cents: q.totalCents,
    stripe_session_id: session.id,
    status: "pending",
    meta: {
      original_check_out_date: q.currentCheckOutDate,
      new_check_out_date: q.newCheckOutDate,
      extra_nights: q.extraNights,
      nightly_rates: q.nightlyRates,
      room_rate_cents: q.roomRateCents,
      tax_total_cents: q.taxTotalCents,
    },
  };

  await admin
    .from("registration")
    .update({ upsells: [...existingUpsells, newUpsell] })
    .eq("id", reg.id);

  return NextResponse.json({ url: session.url });
}
