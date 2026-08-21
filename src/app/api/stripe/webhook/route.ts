import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { pushBookingToLodgify } from "@/lib/lodgify/push";
import { sendDirectBookingConfirmation } from "@/lib/guest-messages/send";
import { applyExtension } from "@/lib/upsells/extend-stay";
import { finalizeIdentitySession } from "@/lib/identity/verify";
import { notifyCleanersOfEarlyCheckin, notifyCleanersOfLateCheckout } from "@/lib/sms/notify-cleaners";
import { notifyHostOfUpsellPurchase } from "@/lib/push/notify-host";
import { timingUpsellTime, STANDARD_CHECKIN_TIME, STANDARD_CHECKOUT_TIME } from "@/lib/upsells/timing";
import Stripe from "stripe";

export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Webhook Error: ${message}` },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const isBooking = session.metadata?.booking_type === "booking";

    // Update payment record
    await supabase
      .from("payment")
      .update({
        status: "completed",
        stripe_payment_intent_id:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id ?? null,
      })
      .eq("stripe_checkout_session_id", session.id);

    if (isBooking) {
      const registrationId = session.metadata?.registration_id;

      // Activate the registration and settle booking-time add-ons: upsells
      // picked in the booking cart were paid as line items of this very
      // checkout, so flip them to "paid" and notify — mirroring
      // /api/guest/upsells/confirm. Cart add-ons bought later carry a
      // stripe_session_id and are confirmed by that flow instead; the
      // no-session-id filter also makes a webhook redelivery a no-op.
      if (registrationId) {
        const { data: reg } = await supabase
          .from("registration")
          .select("id, upsells, property_id, check_in_date, check_out_date, guest:guest_id(full_name)")
          .eq("id", registrationId)
          .single();

        const upsells =
          (reg?.upsells as Array<{ stripe_session_id?: string; status: string; [key: string]: unknown }> | null) ?? [];
        const justPaid = upsells.filter((u) => u.status === "pending" && !u.stripe_session_id);
        const updatedUpsells = upsells.map((u) =>
          u.status === "pending" && !u.stripe_session_id ? { ...u, status: "paid" } : u
        );

        await supabase
          .from("registration")
          .update({ status: "active", ...(justPaid.length > 0 ? { upsells: updatedUpsells } : {}) })
          .eq("id", registrationId);

        if (reg && justPaid.length > 0) {
          const guestRow = reg.guest as unknown as { full_name: string } | null;
          const guestName = guestRow?.full_name ?? "Guest";

          // Awaited — Vercel freezes the function once the response is
          // returned, killing fire-and-forget sends mid-flight.
          for (const u of justPaid) {
            const timingLike = {
              type: u.type as string,
              label: u.label as string | undefined,
              meta: u.meta as Record<string, unknown> | null | undefined,
            };
            if (u.type === "early_checkin" && reg.check_in_date) {
              await notifyCleanersOfEarlyCheckin({
                propertyId: reg.property_id,
                registrationId: reg.id,
                guestName,
                checkIn: reg.check_in_date as string,
                checkInTime: timingUpsellTime(timingLike) ?? STANDARD_CHECKIN_TIME,
              }).catch(() => {});
            }
            if (u.type === "late_checkout" && reg.check_out_date) {
              await notifyCleanersOfLateCheckout({
                propertyId: reg.property_id,
                registrationId: reg.id,
                guestName,
                checkOut: reg.check_out_date as string,
                checkOutTime: timingUpsellTime(timingLike) ?? STANDARD_CHECKOUT_TIME,
              }).catch(() => {});
            }
          }

          await notifyHostOfUpsellPurchase({
            propertyId: reg.property_id,
            registrationId: reg.id,
            guestName,
            labels: justPaid.map((u) => (u.label as string) || (u.type as string)),
            totalCents: justPaid.reduce((sum, u) => sum + (Number(u.price_cents) || 0), 0),
          }).catch(() => {});
        }
      }

      // Increment usage for every applied promo (a booking may stack several).
      // Falls back to the single promo_code_id for older sessions.
      const appliedIds = (session.metadata?.applied_promo_ids || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const promoIds = appliedIds.length
        ? appliedIds
        : session.metadata?.promo_code_id
          ? [session.metadata.promo_code_id]
          : [];
      for (const promoId of promoIds) {
        const { data: promo } = await supabase
          .from("promo_code")
          .select("times_used")
          .eq("id", promoId)
          .single();
        if (promo) {
          await supabase
            .from("promo_code")
            .update({ times_used: promo.times_used + 1 })
            .eq("id", promoId);
        }
      }

      // Push to Lodgify so the booking blocks the calendar and reaches connected
      // channels. Must be awaited: on Vercel the function is frozen once the
      // webhook response is returned, which kills a fire-and-forget push
      // mid-flight and leaves lodgify_sync_status stuck at "pending". Idempotent.
      if (registrationId) {
        await pushBookingToLodgify(registrationId, supabase);
        // Confirmation for our own bookings: the sync.ts path won't send one
        // because the row is already active by the time Lodgify echoes it back.
        await sendDirectBookingConfirmation(registrationId).catch((err) =>
          console.error("[webhook] Booking confirmation failed:", err)
        );
      }
    }

    // Guest stay extension: fulfil idempotently (shared with the return-from-Stripe
    // confirm route) so a closed tab still applies the extension + blocks the added
    // nights on Lodgify. Keyed on the upsell type; sets no booking_type.
    if (session.metadata?.upsell_types?.includes("extend_stay")) {
      await applyExtension(supabase, session.id).catch((err) =>
        console.error("[webhook] extend_stay fulfillment failed:", err)
      );
    }
  }

  if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    const isBooking = session.metadata?.booking_type === "booking";

    // Mark payment as failed
    await supabase
      .from("payment")
      .update({ status: "failed" })
      .eq("stripe_checkout_session_id", session.id);

    // Keep registration as pending_payment (don't delete, don't sync to Lodgify)
    if (isBooking) {
      console.log(`[webhook] Booking checkout expired: registration=${session.metadata?.registration_id}`);
    }
  }

  // Stripe Identity: reconcile the document/selfie verification onto the
  // registration. Idempotent — the client status poll may finalize it first.
  if (
    event.type === "identity.verification_session.verified" ||
    event.type === "identity.verification_session.requires_input"
  ) {
    const vs = event.data.object as Stripe.Identity.VerificationSession;
    await finalizeIdentitySession(supabase, vs).catch((err) =>
      console.error("[webhook] identity finalize failed:", err)
    );
  }

  if (event.type === "payment_intent.payment_failed") {
    const intent = event.data.object as Stripe.PaymentIntent;

    await supabase
      .from("payment")
      .update({ status: "failed" })
      .eq("stripe_payment_intent_id", intent.id);
  }

  // Admin-created booking invoice flow (deposit, balance, or full payment).
  if (event.type === "invoice.paid") {
    const invoice = event.data.object as Stripe.Invoice;
    const registrationId = invoice.metadata?.registration_id;
    const phase = invoice.metadata?.booking_phase;
    if (registrationId && phase) {
      // Resolve the payment_method used so we can off-session charge the balance later.
      let paymentMethodId: string | null = null;
      const piRef = (invoice as unknown as { payment_intent?: string | Stripe.PaymentIntent | null }).payment_intent;
      try {
        if (piRef) {
          const piId = typeof piRef === "string" ? piRef : piRef.id;
          const pi = await stripe.paymentIntents.retrieve(piId);
          if (pi.payment_method) {
            paymentMethodId = typeof pi.payment_method === "string" ? pi.payment_method : pi.payment_method.id;
          }
        }
      } catch (err) {
        console.error("[webhook] Failed to retrieve PaymentIntent for invoice:", err);
      }

      if (phase === "deposit") {
        const updates: Record<string, unknown> = {
          status: "active",
          deposit_paid_at: new Date().toISOString(),
        };
        if (paymentMethodId) updates.stripe_payment_method_id = paymentMethodId;
        await supabase.from("registration").update(updates).eq("id", registrationId);
      } else if (phase === "full") {
        const updates: Record<string, unknown> = {
          status: "active",
          deposit_paid_at: new Date().toISOString(),
          balance_paid_at: new Date().toISOString(),
        };
        if (paymentMethodId) updates.stripe_payment_method_id = paymentMethodId;
        await supabase.from("registration").update(updates).eq("id", registrationId);
      } else if (phase === "balance") {
        await supabase
          .from("registration")
          .update({ balance_paid_at: new Date().toISOString() })
          .eq("id", registrationId);
      }

      // The deposit/full payment confirms the booking — push it to Lodgify so it
      // blocks the calendar and reaches connected channels. (Balance is a later
      // charge on an already-synced booking, so it's skipped.) Idempotent.
      if (phase === "deposit" || phase === "full") {
        await pushBookingToLodgify(registrationId, supabase);
        await sendDirectBookingConfirmation(registrationId).catch((err) =>
          console.error("[webhook] Booking confirmation failed:", err)
        );
      }
    }
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    const registrationId = invoice.metadata?.registration_id;
    const phase = invoice.metadata?.booking_phase;
    // Only the balance invoice retries via cron — log here for visibility.
    if (registrationId && phase === "balance") {
      console.warn(
        `[webhook] Balance invoice ${invoice.id} failed for registration ${registrationId}`
      );
    }
  }

  return NextResponse.json({ received: true });
}
