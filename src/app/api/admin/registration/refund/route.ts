import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";
import type { UpsellEntry } from "@/types/database";

// POST — refund a Stripe-collected add-on (full or partial) on a reservation.
// The target entry is addressed by its index in registration.upsells; the
// session id + type are echoed back so a stale page can't refund the wrong
// entry after the array shifted (e.g. the guest bought another add-on).
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    registration_id: string;
    upsell_index: number;
    stripe_session_id: string;
    upsell_type: string;
    amount_cents?: number;
    reason?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { registration_id, upsell_index, stripe_session_id, upsell_type } = body;
  if (!registration_id || typeof upsell_index !== "number" || !stripe_session_id || !upsell_type) {
    return NextResponse.json(
      { error: "registration_id, upsell_index, stripe_session_id and upsell_type are required" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data: reg } = await admin
    .from("registration")
    .select("id, upsells")
    .eq("id", registration_id)
    .single();
  if (!reg) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 });
  }

  const upsells = (reg.upsells as UpsellEntry[] | null) ?? [];
  const entry = upsells[upsell_index];
  if (!entry || entry.stripe_session_id !== stripe_session_id || entry.type !== upsell_type) {
    return NextResponse.json(
      { error: "This add-on changed since the page loaded — reload and try again" },
      { status: 409 }
    );
  }
  if (entry.status !== "paid") {
    return NextResponse.json(
      { error: `Only paid add-ons can be refunded (status: ${entry.status})` },
      { status: 400 }
    );
  }

  const alreadyRefunded = entry.refunded_cents ?? 0;
  const remaining = entry.price_cents - alreadyRefunded;
  if (remaining <= 0) {
    return NextResponse.json({ error: "This add-on is already fully refunded" }, { status: 400 });
  }
  const amount =
    typeof body.amount_cents === "number" ? Math.round(body.amount_cents) : remaining;
  if (!Number.isFinite(amount) || amount < 1 || amount > remaining) {
    return NextResponse.json(
      { error: `Refund must be between $0.01 and $${(remaining / 100).toFixed(2)}` },
      { status: 400 }
    );
  }

  // Resolve the captured payment intent behind the checkout session. A cart
  // checkout captures ONE intent covering several add-ons, so the refund below
  // is a partial refund scoped to this entry's amount.
  let paymentIntentId: string | null;
  try {
    const session = await stripe.checkout.sessions.retrieve(stripe_session_id);
    if (session.payment_status !== "paid") {
      return NextResponse.json({ error: "This charge was never captured in Stripe" }, { status: 400 });
    }
    paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id ?? null;
  } catch {
    return NextResponse.json({ error: "Could not load the Stripe payment for this add-on" }, { status: 502 });
  }
  if (!paymentIntentId) {
    return NextResponse.json({ error: "No captured payment found for this add-on" }, { status: 400 });
  }

  // Idempotency key pins the refund to the entry's refunded-so-far watermark:
  // a double-click replays the same Stripe request instead of refunding twice.
  let refund: Stripe.Refund;
  try {
    refund = await stripe.refunds.create(
      {
        payment_intent: paymentIntentId,
        amount,
        metadata: {
          registration_id,
          upsell_type: entry.type,
          upsell_label: entry.label,
        },
      },
      { idempotencyKey: `upsell-refund-${registration_id}-${upsell_index}-${alreadyRefunded}` }
    );
  } catch (e) {
    const msg = e instanceof Stripe.errors.StripeError ? e.message : "Stripe refund failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const newRefunded = alreadyRefunded + amount;
  const fullyRefunded = newRefunded >= entry.price_cents;
  const updated = upsells.map((u, i) =>
    i === upsell_index
      ? {
          ...u,
          refunded_cents: newRefunded,
          refunded_at: new Date().toISOString(),
          ...(fullyRefunded ? { status: "refunded" } : {}),
        }
      : u
  );
  const { error: updateError } = await admin
    .from("registration")
    .update({ upsells: updated })
    .eq("id", registration_id);

  const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;
  const reason = body.reason?.trim();
  await admin.from("registration_update_log").insert({
    registration_id,
    changed_by: "admin",
    change_type: "refund",
    summary: `Refunded ${fmt(amount)}${fullyRefunded ? "" : ` of ${fmt(entry.price_cents)}`} for "${entry.label}" via Stripe${reason ? ` — ${reason}` : ""}`,
    new_data: {
      stripe_refund_id: refund.id,
      stripe_payment_intent_id: paymentIntentId,
      amount_cents: amount,
      upsell_type: entry.type,
      fully_refunded: fullyRefunded,
    } as Record<string, unknown>,
  });

  return NextResponse.json({
    ok: true,
    refund_id: refund.id,
    amount_cents: amount,
    fully_refunded: fullyRefunded,
    // The Stripe refund went through even if the local status write failed —
    // surface that instead of pretending the refund didn't happen.
    warning: updateError
      ? "Refund issued in Stripe, but the reservation could not be updated — reload the page."
      : undefined,
  });
}
