"use client";

import { useState } from "react";
import { HandCoins, Minus, Plus } from "lucide-react";
import { KioskScreenShell, KioskEmpty, glassPanel } from "../ui";
import type { KioskBooking } from "../types";

const PRESETS_CENTS = [1000, 2000, 3000, 5000];
const STEP_CENTS = 500;
const MIN_CENTS = 500;
const MAX_CENTS = 50_000;

export function TipScreen({
  token,
  booking,
  timezone,
  onBack,
}: {
  token: string;
  booking: KioskBooking | null;
  timezone: string;
  onBack: () => void;
}) {
  const [amount, setAmount] = useState(2000);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    if (!booking) return;
    setStarting(true);
    setError(null);
    try {
      const res = await fetch(`/api/kiosk/${token}/tip-checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-guest-token": booking.guest_token,
        },
        body: JSON.stringify({
          amount_cents: amount,
          registration_id: booking.reservation.id,
          preview: new URLSearchParams(window.location.search).get("preview") === "1",
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.url) {
        window.location.assign(data.url);
        return;
      }
      setError(data?.error || "Couldn't start checkout. Please try again.");
      setStarting(false);
    } catch {
      setError("Couldn't reach the server. Please try again.");
      setStarting(false);
    }
  }

  return (
    <KioskScreenShell
      title="Tip the Crew"
      subtitle="100% goes to the team that keeps this house spotless"
      timezone={timezone}
      onBack={onBack}
    >
      {!booking ? (
        <KioskEmpty message="Tipping opens once a stay is checked in." />
      ) : (
        <div className="mx-auto flex h-full max-w-3xl flex-col items-center justify-center gap-8 pb-10">
          <HandCoins className="h-16 w-16 text-amber-300" />
          <p className="max-w-xl text-center text-xl leading-relaxed text-(--k-fg-70) lg:text-2xl">
            The cleaning crew turns this house over before every stay. Tips go straight to
            them — nothing is held back.
          </p>

          <div className="grid w-full grid-cols-2 gap-4 lg:grid-cols-4">
            {PRESETS_CENTS.map((cents) => (
              <button
                key={cents}
                type="button"
                onClick={() => setAmount(cents)}
                className={`min-h-24 rounded-3xl text-3xl font-extrabold tabular-nums transition-transform active:scale-[0.97] lg:text-4xl ${
                  amount === cents
                    ? "bg-(--k-featured-bg) text-(--k-featured-fg) shadow-xl"
                    : "bg-(--k-surf-10) text-(--k-fg) ring-1 ring-(--k-surf-15) hover:bg-(--k-surf-15)"
                }`}
              >
                ${cents / 100}
              </button>
            ))}
          </div>

          {/* Custom amount stepper */}
          <div className={`flex items-center gap-6 px-8 py-4 ${glassPanel}`}>
            <button
              type="button"
              onClick={() => setAmount((a) => Math.max(MIN_CENTS, a - STEP_CENTS))}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-(--k-surf-10) ring-1 ring-(--k-surf-15) active:scale-[0.94]"
              aria-label="Lower tip by five dollars"
            >
              <Minus className="h-8 w-8 text-(--k-fg)" />
            </button>
            <span className="w-40 text-center text-5xl font-extrabold text-(--k-fg) tabular-nums">
              ${(amount / 100).toFixed(amount % 100 === 0 ? 0 : 2)}
            </span>
            <button
              type="button"
              onClick={() => setAmount((a) => Math.min(MAX_CENTS, a + STEP_CENTS))}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-(--k-surf-10) ring-1 ring-(--k-surf-15) active:scale-[0.94]"
              aria-label="Raise tip by five dollars"
            >
              <Plus className="h-8 w-8 text-(--k-fg)" />
            </button>
          </div>

          {error && (
            <p className="rounded-2xl bg-rose-500/15 px-5 py-4 text-lg text-rose-200 ring-1 ring-rose-400/30">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={pay}
            disabled={starting}
            className="flex min-h-20 w-full max-w-md items-center justify-center gap-3 rounded-3xl bg-amber-400 text-2xl font-extrabold text-zinc-900 shadow-xl transition-transform active:scale-[0.97] disabled:opacity-60 lg:text-3xl"
          >
            {starting ? "Starting checkout…" : `Tip $${(amount / 100).toFixed(amount % 100 === 0 ? 0 : 2)}`}
          </button>
        </div>
      )}
    </KioskScreenShell>
  );
}
