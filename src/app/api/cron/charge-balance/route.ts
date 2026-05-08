import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";
import { createAndFinalizeBookingInvoice } from "@/lib/stripe/booking-invoices";
import {
  sendBalanceChargeFailedEmail,
  sendBookingCancelledNonpaymentEmail,
} from "@/lib/email/send-booking-invoice";

export const maxDuration = 60;

const MAX_ATTEMPTS = 3;
const BALANCE_LEAD_DAYS = 30;

// GET /api/cron/charge-balance
// Daily cron. For every active split-pay booking whose check-in is <= 30 days away
// and whose balance is unpaid:
//   - Attempt 1 (no balance invoice yet): create + auto-charge balance invoice using
//     the saved payment method on the customer.
//   - Attempts 2/3: try paying the existing balance invoice again (off-session).
//   - On 3rd consecutive failure: cancel the booking, deposit forfeited.
//
// Stripe will fire `invoice.paid` on success and `invoice.payment_failed` on failure;
// we read the invoice's status here so we don't double-bump the attempt counter.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createAdminClient();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const cutoffDate = new Date(today.getTime() + BALANCE_LEAD_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const todayIso = today.toISOString().slice(0, 10);

  // Pull split-pay bookings due for balance charge
  type BookingRow = {
    id: string;
    check_in_date: string;
    check_out_date: string;
    total_amount_cents: number;
    deposit_paid_at: string | null;
    balance_paid_at: string | null;
    balance_charge_attempts: number;
    balance_last_attempt_at: string | null;
    stripe_customer_id: string | null;
    stripe_payment_method_id: string | null;
    stripe_balance_invoice_id: string | null;
    guest: { full_name: string; email: string | null } | null;
    property: { name: string; nickname: string | null } | null;
  };

  const { data: rows, error } = await supabase
    .from("registration")
    .select(
      "id, check_in_date, check_out_date, total_amount_cents, deposit_paid_at, balance_paid_at, balance_charge_attempts, balance_last_attempt_at, stripe_customer_id, stripe_payment_method_id, stripe_balance_invoice_id, guest:guest_id(full_name, email), property:property_id(name, nickname)"
    )
    .eq("status", "active")
    .eq("payment_plan", "split")
    .is("balance_paid_at", null)
    .not("deposit_paid_at", "is", null)
    .lte("check_in_date", cutoffDate);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  let processed = 0;
  let charged = 0;
  let retried = 0;
  let cancelled = 0;
  const errors: { id: string; reason: string }[] = [];

  for (const r of (rows ?? []) as unknown as BookingRow[]) {
    processed++;
    const guest = Array.isArray(r.guest) ? r.guest[0] : r.guest;
    const property = Array.isArray(r.property) ? r.property[0] : r.property;
    const propertyLabel = property?.nickname || property?.name || "your stay";
    const balanceCents = r.total_amount_cents - Math.round(r.total_amount_cents / 2);
    const depositCents = Math.round(r.total_amount_cents / 2);

    // Don't double-attempt within the same UTC day
    if (r.balance_last_attempt_at) {
      const lastAttemptDay = r.balance_last_attempt_at.slice(0, 10);
      if (lastAttemptDay === todayIso) continue;
    }

    if (!r.stripe_customer_id || !r.stripe_payment_method_id) {
      errors.push({ id: r.id, reason: "Missing customer or payment method" });
      continue;
    }

    // First attempt: create the balance invoice
    if (!r.stripe_balance_invoice_id) {
      try {
        const description = `Balance (50%) — ${propertyLabel}, ${r.check_in_date} to ${r.check_out_date}`;
        const inv = await createAndFinalizeBookingInvoice({
          customerId: r.stripe_customer_id,
          registrationId: r.id,
          amountCents: balanceCents,
          phase: "balance",
          description,
          daysUntilDue: 0,
          collectAutomatically: true,
          defaultPaymentMethodId: r.stripe_payment_method_id,
        });
        // Stripe auto-charges on finalization for `charge_automatically`.
        // If it succeeded synchronously, the webhook will mark balance_paid_at — but
        // we still record the attempt here so the cron sees it.
        const paid = await stripe.invoices.retrieve(inv.id!);
        const succeeded = paid.status === "paid";
        await supabase
          .from("registration")
          .update({
            stripe_balance_invoice_id: inv.id,
            balance_charge_attempts: r.balance_charge_attempts + 1,
            balance_last_attempt_at: new Date().toISOString(),
            balance_last_failure_reason: succeeded ? null : paid.last_finalization_error?.message ?? "Charge failed",
          })
          .eq("id", r.id);

        if (succeeded) {
          charged++;
        } else if (guest?.email) {
          await safeEmail(() =>
            sendBalanceChargeFailedEmail({
              to: guest.email!,
              guestName: guest.full_name,
              propertyName: propertyLabel,
              checkInDate: r.check_in_date,
              amountCents: balanceCents,
              attemptNumber: r.balance_charge_attempts + 1,
              hostedInvoiceUrl: paid.hosted_invoice_url ?? null,
            })
          );
          retried++;
        }
      } catch (err) {
        const reason = err instanceof Error ? err.message : "Unknown";
        await supabase
          .from("registration")
          .update({
            balance_charge_attempts: r.balance_charge_attempts + 1,
            balance_last_attempt_at: new Date().toISOString(),
            balance_last_failure_reason: reason,
          })
          .eq("id", r.id);
        errors.push({ id: r.id, reason });
      }
      continue;
    }

    // Subsequent attempts: retry the existing balance invoice off-session
    try {
      const before = await stripe.invoices.retrieve(r.stripe_balance_invoice_id);
      if (before.status === "paid") {
        await supabase
          .from("registration")
          .update({ balance_paid_at: new Date().toISOString() })
          .eq("id", r.id);
        charged++;
        continue;
      }

      const paid = await stripe.invoices.pay(r.stripe_balance_invoice_id, {
        payment_method: r.stripe_payment_method_id,
        off_session: true,
      });

      const newAttempts = r.balance_charge_attempts + 1;
      const succeeded = paid.status === "paid";

      if (succeeded) {
        await supabase
          .from("registration")
          .update({
            balance_paid_at: new Date().toISOString(),
            balance_charge_attempts: newAttempts,
            balance_last_attempt_at: new Date().toISOString(),
            balance_last_failure_reason: null,
          })
          .eq("id", r.id);
        charged++;
      } else {
        // Treat any non-paid response as failure for retry tracking
        await handleFailedAttempt({
          supabase,
          registrationId: r.id,
          newAttempts,
          reason: paid.last_finalization_error?.message ?? "Off-session charge failed",
          guestEmail: guest?.email ?? null,
          guestName: guest?.full_name ?? "Guest",
          propertyLabel,
          checkInDate: r.check_in_date,
          balanceCents,
          depositCents,
          hostedInvoiceUrl: paid.hosted_invoice_url ?? null,
        });
        if (newAttempts >= MAX_ATTEMPTS) cancelled++;
        else retried++;
      }
    } catch (err) {
      const newAttempts = r.balance_charge_attempts + 1;
      const reason = err instanceof Error ? err.message : "Unknown";
      let hostedInvoiceUrl: string | null = null;
      try {
        const inv = await stripe.invoices.retrieve(r.stripe_balance_invoice_id);
        hostedInvoiceUrl = inv.hosted_invoice_url ?? null;
      } catch {}
      await handleFailedAttempt({
        supabase,
        registrationId: r.id,
        newAttempts,
        reason,
        guestEmail: guest?.email ?? null,
        guestName: guest?.full_name ?? "Guest",
        propertyLabel,
        checkInDate: r.check_in_date,
        balanceCents,
        depositCents,
        hostedInvoiceUrl,
      });
      if (newAttempts >= MAX_ATTEMPTS) cancelled++;
      else retried++;
    }
  }

  return NextResponse.json({ ok: true, processed, charged, retried, cancelled, errors });
}

async function safeEmail(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.error("[charge-balance] email error:", err);
  }
}

async function handleFailedAttempt(params: {
  supabase: ReturnType<typeof createAdminClient>;
  registrationId: string;
  newAttempts: number;
  reason: string;
  guestEmail: string | null;
  guestName: string;
  propertyLabel: string;
  checkInDate: string;
  balanceCents: number;
  depositCents: number;
  hostedInvoiceUrl: string | null;
}) {
  const isFinal = params.newAttempts >= MAX_ATTEMPTS;

  const updates: Record<string, unknown> = {
    balance_charge_attempts: params.newAttempts,
    balance_last_attempt_at: new Date().toISOString(),
    balance_last_failure_reason: params.reason,
  };
  if (isFinal) updates.status = "cancelled";

  await params.supabase.from("registration").update(updates).eq("id", params.registrationId);

  if (!params.guestEmail) return;

  if (isFinal) {
    await safeEmail(() =>
      sendBookingCancelledNonpaymentEmail({
        to: params.guestEmail!,
        guestName: params.guestName,
        propertyName: params.propertyLabel,
        checkInDate: params.checkInDate,
        depositCents: params.depositCents,
      })
    );
  } else {
    await safeEmail(() =>
      sendBalanceChargeFailedEmail({
        to: params.guestEmail!,
        guestName: params.guestName,
        propertyName: params.propertyLabel,
        checkInDate: params.checkInDate,
        amountCents: params.balanceCents,
        attemptNumber: params.newAttempts,
        hostedInvoiceUrl: params.hostedInvoiceUrl,
      })
    );
  }
}
