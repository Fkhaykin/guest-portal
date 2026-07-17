import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";
import { verifyGuestToken } from "@/lib/guest-token";
import { quoteExtension } from "@/lib/upsells/extend-stay";
import {
  STANDARD_MAX_TIMING_HOURS,
  timingDurationOptions,
  timingHourlyCents,
} from "@/lib/upsells/timing";
import {
  hostPropertyIds,
  lateCheckoutAvailability,
  type TimingOverride,
} from "@/lib/upsells/availability";

// Create a Stripe Checkout session for a stay extension. Re-quotes server-side so
// the charged amount can't be tampered with, then records a pending extend_stay
// upsell carrying everything the fulfillment step needs. Optionally bundles a
// late checkout on the NEW final day into the same session (one payment, one
// fulfillment pass) — priced and availability-checked server-side too.
export async function POST(request: Request) {
  let body: {
    registration_id: string;
    new_check_out_date: string;
    late_checkout_hours?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { registration_id, new_check_out_date, late_checkout_hours } = body;
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
    .select(
      "id, upsells, property_id, check_in_date, late_checkout_override, late_checkout_override_hours"
    )
    .eq("id", registration_id)
    .single();
  if (!reg) return NextResponse.json({ error: "Reservation not found" }, { status: 404 });

  const { data: property } = await admin
    .from("property")
    .select("slug, host_id")
    .eq("id", reg.property_id)
    .single();

  const existingUpsells = (reg.upsells as Array<Record<string, unknown>>) || [];

  // Optional bundled late checkout — validated against the NEW checkout day.
  let lateTier: { hours: number; time_label: string; price_cents: number } | null = null;
  if (late_checkout_hours) {
    const alreadyPaid = existingUpsells.some(
      (u) => u.type === "late_checkout" && u.status === "paid"
    );
    if (alreadyPaid) {
      return NextResponse.json(
        { error: "Late checkout is already confirmed for this stay." },
        { status: 400 }
      );
    }
    const allPropertyIds = await hostPropertyIds(admin, property?.host_id as string);
    const lateAvail = await lateCheckoutAvailability(
      admin,
      {
        propertyIds: allPropertyIds,
        excludeRegistrationId: reg.id,
        override: reg.late_checkout_override as TimingOverride,
      },
      q.newCheckOutDate
    );
    if (!lateAvail.available) {
      return NextResponse.json(
        {
          error:
            lateAvail.reason ||
            "Late checkout isn't available on your new checkout day — you can still extend without it.",
          late_unavailable: true,
        },
        { status: 409 }
      );
    }
    const maxHours =
      reg.late_checkout_override === "allow" && reg.late_checkout_override_hours
        ? (reg.late_checkout_override_hours as number)
        : STANDARD_MAX_TIMING_HOURS;
    const hourly = timingHourlyCents(reg.check_in_date as string, q.newCheckOutDate);
    const tiers = timingDurationOptions("late_checkout", hourly, maxHours);
    lateTier = tiers.find((t) => t.hours === late_checkout_hours) ?? null;
    if (!lateTier) {
      return NextResponse.json(
        { error: "That late-checkout option isn't available." },
        { status: 400 }
      );
    }
  }

  const host = request.headers.get("host") || "localhost:3000";
  const proto = request.headers.get("x-forwarded-proto") || "http";
  const appUrl = `${proto}://${host}`;
  const slug = property?.slug || "";

  const label = `Extended stay — ${q.extraNights} night${q.extraNights !== 1 ? "s" : ""} (checkout ${q.newCheckOutDate})`;
  const lateLabel = lateTier ? `Late Check-Out (until ${lateTier.time_label})` : null;

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
      ...(lateTier && lateLabel
        ? [
            {
              price_data: {
                currency: "usd",
                product_data: { name: lateLabel },
                unit_amount: lateTier.price_cents,
              },
              quantity: 1,
            },
          ]
        : []),
    ],
    mode: "payment",
    success_url: `${appUrl}/p/${slug}/extend-stay?extend_success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/p/${slug}/extend-stay?extend_cancelled=true`,
    metadata: {
      registration_id,
      upsell_types: lateTier ? "extend_stay,late_checkout" : "extend_stay",
      new_check_out_date: q.newCheckOutDate,
      extra_nights: String(q.extraNights),
    },
  });

  const newUpsells: Array<Record<string, unknown>> = [
    {
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
    },
  ];
  if (lateTier && lateLabel) {
    newUpsells.push({
      type: "late_checkout",
      label: lateLabel,
      price_cents: lateTier.price_cents,
      stripe_session_id: session.id,
      status: "pending",
      meta: { hours: lateTier.hours },
    });
  }

  await admin
    .from("registration")
    .update({ upsells: [...existingUpsells, ...newUpsells] })
    .eq("id", reg.id);

  return NextResponse.json({ url: session.url });
}
