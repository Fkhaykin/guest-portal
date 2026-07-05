"use client";

import { useState } from "react";
import { ShoppingBag } from "lucide-react";
import { KioskScreenShell, KioskEmpty, KioskSpinner, glassPanel } from "../ui";
import type { KioskBooking, KioskService } from "../types";

export function ServicesScreen({
  token,
  services,
  failed,
  booking,
  timezone,
  onBack,
}: {
  token: string;
  services: KioskService[] | null;
  failed: boolean;
  booking: KioskBooking | null;
  timezone: string;
  onBack: () => void;
}) {
  const [buying, setBuying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function purchase(service: KioskService) {
    if (!booking) return;
    setBuying(service.id);
    setError(null);
    try {
      const res = await fetch(`/api/kiosk/${token}/service-checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-guest-token": booking.guest_token,
        },
        body: JSON.stringify({
          service_id: service.id,
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
      setBuying(null);
    } catch {
      setError("Couldn't reach the server. Please try again.");
      setBuying(null);
    }
  }

  return (
    <KioskScreenShell
      title="Services"
      subtitle="Enhance your stay with additional services"
      timezone={timezone}
      onBack={onBack}
    >
      {services === null ? (
        failed ? <KioskEmpty message={"This screen isn't loading right now — it retries automatically, or tap Home and try again."} /> : <KioskSpinner />
      ) : services.length === 0 ? (
        <KioskEmpty message="There are no additional services for this house right now." />
      ) : (
        <div className="space-y-5 pb-8">
          {error && (
            <p className="rounded-2xl bg-rose-500/15 px-5 py-4 text-lg text-rose-200 ring-1 ring-rose-400/30">
              {error}
            </p>
          )}
          {!booking && (
            <p className="rounded-2xl bg-white/5 px-5 py-4 text-lg text-white/60 ring-1 ring-white/10">
              Purchases open once a stay is checked in — browse away for now.
            </p>
          )}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {services.map((service) => (
              <div key={service.id} className={`flex items-center gap-6 p-6 ${glassPanel}`}>
                {service.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={service.image_url}
                    alt=""
                    className="h-28 w-28 shrink-0 rounded-2xl object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="text-2xl font-extrabold text-white">{service.name}</h2>
                  {service.description && (
                    <p className="mt-2 text-base leading-relaxed text-white/65">{service.description}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-3">
                  <span className="text-3xl font-extrabold text-white tabular-nums">
                    ${(service.price_cents / 100).toFixed(2)}
                  </span>
                  {booking && (
                    <button
                      type="button"
                      onClick={() => purchase(service)}
                      disabled={buying !== null}
                      className="flex min-h-16 items-center gap-3 rounded-2xl bg-white px-7 text-xl font-bold text-zinc-900 transition-transform active:scale-[0.97] disabled:opacity-60"
                    >
                      <ShoppingBag className="h-6 w-6" />
                      {buying === service.id ? "Starting…" : "Purchase"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </KioskScreenShell>
  );
}
