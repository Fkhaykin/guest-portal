"use client";

import { useState } from "react";

const SPLIT_MIN_LEAD_DAYS = 60;

function fmt(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

interface Props {
  registrationId: string;
  totalCents: number;
  splitAllowed: boolean;
  daysUntilCheckin: number;
}

export function PayPlanPicker({ registrationId, totalCents, splitAllowed, daysUntilCheckin }: Props) {
  const [submitting, setSubmitting] = useState<"full" | "split" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(plan: "full" | "split") {
    setSubmitting(plan);
    setError(null);
    try {
      const res = await fetch("/api/guest/pay-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registration_id: registrationId, plan }),
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

  return (
    <div className="space-y-3 pt-2">
      <button
        type="button"
        onClick={() => pick("full")}
        disabled={submitting !== null}
        className="w-full text-left rounded-md border p-4 transition hover:bg-accent disabled:opacity-50"
      >
        <div className="font-medium">Pay in full</div>
        <div className="text-xs text-muted-foreground mt-1">
          Charge {fmt(totalCents)} now via Stripe.
        </div>
      </button>

      <button
        type="button"
        onClick={() => splitAllowed && pick("split")}
        disabled={!splitAllowed || submitting !== null}
        className={`w-full text-left rounded-md border p-4 transition ${splitAllowed ? "hover:bg-accent" : "opacity-50 cursor-not-allowed"} disabled:opacity-50`}
      >
        <div className="font-medium">50% deposit + 50% balance</div>
        <div className="text-xs text-muted-foreground mt-1">
          {splitAllowed
            ? `Pay ${fmt(halfNow)} now; we'll auto-charge the remaining ${fmt(totalCents - halfNow)} 30 days before check-in.`
            : `Available only when check-in is ${SPLIT_MIN_LEAD_DAYS}+ days away (currently ${daysUntilCheckin} day${daysUntilCheckin === 1 ? "" : "s"}).`}
        </div>
      </button>

      {submitting && (
        <p className="text-xs text-muted-foreground">Setting up your Stripe invoice…</p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
