import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { createBooking } from "@/lib/lodgify/client";
import Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";

async function syncBookingToLodgify(registrationId: string, supabase: SupabaseClient) {
  const { data: reg } = await supabase
    .from("registration")
    .select("*, guest:guest_id(full_name, email, phone), property:property_id(lodgify_property_id)")
    .eq("id", registrationId)
    .single();

  if (!reg) return;

  const guest = reg.guest as unknown as { full_name: string; email: string | null; phone: string | null } | null;
  const prop = reg.property as unknown as { lodgify_property_id: number | null } | null;

  if (!prop?.lodgify_property_id || !guest) {
    await supabase.from("registration").update({ lodgify_sync_status: "failed" }).eq("id", registrationId);
    return;
  }

  try {
    const bookingId = await createBooking({
      propertyId: prop.lodgify_property_id,
      arrival: reg.check_in_date,
      departure: reg.check_out_date,
      guestName: guest.full_name,
      guestEmail: guest.email || "",
      guestPhone: guest.phone || "",
      guests: reg.num_guests || 1,
      totalAmount: (reg.total_amount_cents || 0) / 100,
      source: "Direct",
    });
    await supabase
      .from("registration")
      .update({ lodgify_booking_id: bookingId, lodgify_sync_status: "synced" })
      .eq("id", registrationId);
  } catch (err) {
    console.error(`[lodgify-sync] Failed to create booking for registration ${registrationId}:`, err);
    await supabase.from("registration").update({ lodgify_sync_status: "failed" }).eq("id", registrationId);
  }
}

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
      const promoCodeId = session.metadata?.promo_code_id;

      // Activate the registration
      if (registrationId) {
        await supabase
          .from("registration")
          .update({ status: "active" })
          .eq("id", registrationId);
      }

      // Increment promo code usage
      if (promoCodeId) {
        const { data: promo } = await supabase
          .from("promo_code")
          .select("times_used")
          .eq("id", promoCodeId)
          .single();
        if (promo) {
          await supabase
            .from("promo_code")
            .update({ times_used: promo.times_used + 1 })
            .eq("id", promoCodeId);
        }
      }

      // Sync to Lodgify (fire-and-forget)
      if (registrationId) {
        syncBookingToLodgify(registrationId, supabase).catch((err) => {
          console.error("[webhook] Lodgify sync failed:", err);
        });
      }
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
