"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard, AlertCircle, Info } from "lucide-react";

const SPLIT_MIN_LEAD_DAYS = 60;

function fmt(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

interface Props {
  registrationId: string;
  plan: "full" | "split" | "automatic";
  totalCents: number;
  splitAllowed: boolean;
  daysUntilCheckin: number;
  hasInvoice: boolean;
  demoMode?: boolean;
}

export function PayActions({
  registrationId,
  plan,
  totalCents,
  splitAllowed,
  daysUntilCheckin,
  hasInvoice,
  demoMode,
}: Props) {
  const [submitting, setSubmitting] = useState<"full" | "split" | "existing" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [demoNotice, setDemoNotice] = useState<string | null>(null);

  function showDemoNotice(action: string) {
    setDemoNotice(`Demo mode — in production this would redirect you to Stripe to ${action}.`);
    setTimeout(() => setDemoNotice(null), 4000);
  }

  async function payExisting() {
    if (demoMode) return showDemoNotice("complete payment");
    setSubmitting("existing");
    setError(null);
    try {
      const res = await fetch(`/api/guest/invoice-url?registration_id=${registrationId}`);
      const data = await res.json();
      if (!res.ok || !data.hosted_invoice_url) {
        setError(data.error || "Could not load your invoice. Please try again.");
        return;
      }
      window.location.href = data.hosted_invoice_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSubmitting(null);
    }
  }

  async function pickPlan(picked: "full" | "split") {
    if (demoMode) return showDemoNotice(picked === "full" ? "pay the full amount" : "pay the 50% deposit");
    setSubmitting(picked);
    setError(null);
    try {
      const res = await fetch("/api/guest/pay-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registration_id: registrationId, plan: picked }),
      });
      const data = await res.json();
      if (!res.ok || !data.hosted_invoice_url) {
        setError(data.error || "Could not set up your invoice. Please try again.");
        return;
      }
      window.location.href = data.hosted_invoice_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSubmitting(null);
    }
  }

  const halfNow = Math.round(totalCents / 2);

  // Full / split: plan is locked by the admin. Show one pay button, or a
  // contact-us message if the invoice somehow wasn't created.
  if (plan === "full" || plan === "split") {
    if (!hasInvoice) {
      return (
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
          <p>Your invoice isn&apos;t ready yet. Please reply to the email we sent so we can get this sorted.</p>
        </div>
      );
    }
    const isSplit = plan === "split";
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <CreditCard className="h-4 w-4" />
          Payment
        </div>
        <Button
          type="button"
          size="lg"
          className="w-full"
          onClick={payExisting}
          disabled={submitting !== null}
        >
          {submitting === "existing" ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : null}
          {isSplit ? `Pay ${fmt(halfNow)} deposit` : `Pay ${fmt(totalCents)}`}
        </Button>
        <p className="text-xs text-muted-foreground">
          {isSplit
            ? `You'll be charged ${fmt(halfNow)} now. The remaining ${fmt(totalCents - halfNow)} is automatically charged to your saved card 30 days before check-in.`
            : `You'll be redirected to our secure Stripe invoice page to enter your card details.`}
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  // Automatic — guest picks the plan. Two buttons.
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <CreditCard className="h-4 w-4" />
        Choose how to pay
      </div>

      <button
        type="button"
        onClick={() => pickPlan("full")}
        disabled={submitting !== null}
        className="w-full text-left rounded-md border p-4 transition hover:bg-accent disabled:opacity-50"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Pay in full</div>
            <div className="text-xs text-muted-foreground mt-1">
              Charge {fmt(totalCents)} now via Stripe.
            </div>
          </div>
          {submitting === "full" && <Loader2 className="h-4 w-4 animate-spin" />}
        </div>
      </button>

      <button
        type="button"
        onClick={() => splitAllowed && pickPlan("split")}
        disabled={!splitAllowed || submitting !== null}
        className={`w-full text-left rounded-md border p-4 transition ${splitAllowed ? "hover:bg-accent" : "opacity-50 cursor-not-allowed"} disabled:opacity-50`}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">50% deposit + 50% balance</div>
            <div className="text-xs text-muted-foreground mt-1">
              {splitAllowed
                ? `Pay ${fmt(halfNow)} now; we'll auto-charge the remaining ${fmt(totalCents - halfNow)} 30 days before check-in.`
                : `Available only when check-in is ${SPLIT_MIN_LEAD_DAYS}+ days away (currently ${daysUntilCheckin} day${daysUntilCheckin === 1 ? "" : "s"}).`}
            </div>
          </div>
          {submitting === "split" && <Loader2 className="h-4 w-4 animate-spin" />}
        </div>
      </button>

      {error && (
        <p className="text-sm text-destructive flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          {error}
        </p>
      )}

      {demoNotice && (
        <p className="text-sm text-blue-700 dark:text-blue-300 flex items-start gap-2 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-md p-2">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          {demoNotice}
        </p>
      )}
    </div>
  );
}
