"use client";

import { KioskScreenShell, KioskEmpty, KioskSpinner } from "../ui";
import type { Promo } from "@/lib/promo/types";
import { headlineFromOffers, offerLabel } from "@/lib/promo/display";
import {
  accentOf,
  legacyStyleFor,
} from "@/app/(guest)/p/[slug]/promotions/promotion-cards";

// Kiosk-native rendering of the same promo data the portal promotions page
// shows — no clipboard, no external "Book Direct" tab; the kiosk just shows
// the code and how it applies.
export function PromosScreen({
  promos,
  failed,
  timezone,
  onBack,
}: {
  promos: Promo[] | null;
  failed: boolean;
  timezone: string;
  onBack: () => void;
}) {
  return (
    <KioskScreenShell
      title="Promotions"
      subtitle="Guest exclusives — direct bookings at summitlakeside.com"
      timezone={timezone}
      onBack={onBack}
    >
      {promos === null ? (
        failed ? <KioskEmpty message={"This screen isn't loading right now — it retries automatically, or tap Home and try again."} /> : <KioskSpinner />
      ) : promos.length === 0 ? (
        <KioskEmpty message="No promotions are running right now — check back soon." />
      ) : (
        <div className="grid grid-cols-1 gap-5 pb-8 lg:grid-cols-2 2xl:grid-cols-3">
          {promos.map((promo) => {
            const legacy = legacyStyleFor(promo);
            const accent = accentOf(legacy?.accent ?? promo.accent);
            const emoji = legacy?.emoji ?? promo.emoji ?? "🎁";
            const label = legacy?.label ?? (promo.featured ? "Featured" : "Guest Exclusive");
            const highlight = legacy?.highlight ?? headlineFromOffers(promo.offers);
            const pills = promo.terms.length
              ? promo.terms
              : legacy?.terms?.length
                ? legacy.terms
                : promo.offers.filter((o) => o.kind !== "perk").map(offerLabel);
            const perks = promo.offers.filter((o) => o.kind === "perk");

            return (
              <div
                key={promo.id}
                className={`flex flex-col rounded-3xl border p-7 backdrop-blur-md ${accent.border} ${accent.bg}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-4xl">{emoji}</span>
                    <span className={`text-xs font-semibold uppercase tracking-[0.25em] ${accent.muted}`}>
                      {label}
                    </span>
                  </div>
                  {highlight && (
                    <div className="text-right">
                      <p className={`text-4xl font-extrabold leading-none lg:text-5xl ${accent.text}`}>{highlight.big}</p>
                      <p className={`mt-1.5 text-sm ${accent.muted}`}>{highlight.sub}</p>
                    </div>
                  )}
                </div>

                <h2 className="mt-5 text-3xl font-extrabold text-white lg:text-4xl">{promo.title || "Guest Offer"}</h2>
                {promo.description && (
                  <p className="mt-3 text-lg leading-relaxed text-white/70">{promo.description}</p>
                )}

                {(pills.length > 0 || perks.length > 0) && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {pills.map((pill) => (
                      <span
                        key={pill}
                        className={`rounded-full px-4 py-2 text-base font-medium text-white/85 ${accent.chip}`}
                      >
                        {pill}
                      </span>
                    ))}
                    {perks.map((perk) => (
                      <span
                        key={perk.label}
                        className={`rounded-full px-4 py-2 text-base font-medium text-white/85 ${accent.chip}`}
                      >
                        🎁 {perk.label}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-auto pt-5">
                  {promo.code ? (
                    <div className="flex items-center justify-between gap-3 rounded-xl bg-zinc-950/40 px-4 py-3 ring-1 ring-white/10">
                      <span className="text-sm uppercase tracking-[0.25em] text-white/50">Code</span>
                      <span className={`text-3xl font-extrabold tracking-widest ${accent.text}`}>{promo.code}</span>
                    </div>
                  ) : (
                    <p className="text-lg text-white/60">
                      {promo.auto_apply
                        ? "Automatic — applied at checkout"
                        : "No code needed — just mention this offer"}
                    </p>
                  )}
                  {(promo.valid_from || promo.valid_until) && (
                    <p className="mt-4 text-sm text-white/45">
                      {promo.valid_from &&
                        `From ${new Date(promo.valid_from).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                      {promo.valid_from && promo.valid_until && " — "}
                      {promo.valid_until &&
                        `Until ${new Date(promo.valid_until).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </KioskScreenShell>
  );
}
