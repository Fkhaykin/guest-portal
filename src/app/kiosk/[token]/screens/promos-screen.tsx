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
                {/* Eyebrow: fixed-size emoji badge + label */}
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center text-2xl leading-none">
                    {emoji}
                  </span>
                  <span className={`text-sm font-semibold uppercase tracking-[0.2em] ${accent.muted}`}>
                    {label}
                  </span>
                </div>

                {/* Hero: the discount is the single biggest thing on the card */}
                {highlight && (
                  <div className="mt-5">
                    <span className={`text-5xl font-bold leading-none lg:text-6xl ${accent.text}`}>
                      {highlight.big}
                    </span>
                    <span className={`ml-2 text-base ${accent.muted}`}>{highlight.sub}</span>
                  </div>
                )}

                {/* Title (medium) + description (body) */}
                <h2 className="mt-4 text-2xl font-bold leading-snug text-white">
                  {promo.title || "Guest Offer"}
                </h2>
                {promo.description && (
                  <p className="mt-2 text-base leading-relaxed text-white/65">{promo.description}</p>
                )}

                {(pills.length > 0 || perks.length > 0) && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {pills.map((pill) => (
                      <span
                        key={pill}
                        className={`rounded-full px-3 py-1.5 text-sm font-medium text-white/80 ${accent.chip}`}
                      >
                        {pill}
                      </span>
                    ))}
                    {perks.map((perk) => (
                      <span
                        key={perk.label}
                        className={`rounded-full px-3 py-1.5 text-sm font-medium text-white/80 ${accent.chip}`}
                      >
                        🎁 {perk.label}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-auto pt-5">
                  {promo.code ? (
                    <div className="flex items-center justify-between gap-3 rounded-xl bg-zinc-950/40 px-4 py-3 ring-1 ring-white/10">
                      <span className="text-xs font-semibold uppercase tracking-[0.25em] text-white/50">Code</span>
                      <span className={`text-2xl font-bold tracking-[0.2em] ${accent.text}`}>{promo.code}</span>
                    </div>
                  ) : (
                    <p className="text-base text-white/60">
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
