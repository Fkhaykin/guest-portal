"use client";

import { useState } from "react";
import { Copy, Check, ArrowUpRight } from "lucide-react";
import type { Promo } from "@/lib/promo/types";
import { headlineFromOffers, offerLabel } from "@/lib/promo/display";

const BOOKING_URL = "https://summitlakeside.com";

type AccentClasses = {
  text: string;
  muted: string;
  border: string;
  bg: string;
  chip: string;
};

const ACCENT_CLASSES: Record<string, AccentClasses> = {
  emerald: {
    text: "text-emerald-700 dark:text-emerald-400",
    muted: "text-emerald-600/70 dark:text-emerald-400/70",
    border: "border-emerald-200 dark:border-emerald-800/50",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    chip: "bg-emerald-100 dark:bg-emerald-900/40",
  },
  indigo: {
    text: "text-indigo-700 dark:text-indigo-400",
    muted: "text-indigo-600/70 dark:text-indigo-400/70",
    border: "border-indigo-200 dark:border-indigo-800/50",
    bg: "bg-indigo-50 dark:bg-indigo-950/30",
    chip: "bg-indigo-100 dark:bg-indigo-900/40",
  },
  amber: {
    text: "text-amber-700 dark:text-amber-400",
    muted: "text-amber-600/70 dark:text-amber-400/70",
    border: "border-amber-200 dark:border-amber-800/50",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    chip: "bg-amber-100 dark:bg-amber-900/40",
  },
  rose: {
    text: "text-rose-700 dark:text-rose-400",
    muted: "text-rose-600/70 dark:text-rose-400/70",
    border: "border-rose-200 dark:border-rose-800/50",
    bg: "bg-rose-50 dark:bg-rose-950/30",
    chip: "bg-rose-100 dark:bg-rose-900/40",
  },
  orange: {
    text: "text-orange-700 dark:text-orange-400",
    muted: "text-orange-600/70 dark:text-orange-400/70",
    border: "border-orange-200 dark:border-orange-800/50",
    bg: "bg-orange-50 dark:bg-orange-950/30",
    chip: "bg-orange-100 dark:bg-orange-900/40",
  },
  sky: {
    text: "text-sky-700 dark:text-sky-400",
    muted: "text-sky-600/70 dark:text-sky-400/70",
    border: "border-sky-200 dark:border-sky-800/50",
    bg: "bg-sky-50 dark:bg-sky-950/30",
    chip: "bg-sky-100 dark:bg-sky-900/40",
  },
  violet: {
    text: "text-violet-700 dark:text-violet-400",
    muted: "text-violet-600/70 dark:text-violet-400/70",
    border: "border-violet-200 dark:border-violet-800/50",
    bg: "bg-violet-50 dark:bg-violet-950/30",
    chip: "bg-violet-100 dark:bg-violet-900/40",
  },
  slate: {
    text: "text-slate-700 dark:text-slate-300",
    muted: "text-slate-600/70 dark:text-slate-400/70",
    border: "border-slate-200 dark:border-slate-700/50",
    bg: "bg-slate-50 dark:bg-slate-900/30",
    chip: "bg-slate-100 dark:bg-slate-800/40",
  },
};

function accentOf(accent: string | null | undefined): AccentClasses {
  return ACCENT_CLASSES[accent ?? "emerald"] ?? ACCENT_CLASSES.emerald;
}

// Presentation fallback for the curated marketing promos that predate the Promo
// Builder — their emoji/accent/highlight/terms used to live in this component's
// hardcoded style map rather than the DB, so migrated rows have empty offers and
// no styling. Matched by title (codes are mostly absent). Any promo a host edits
// in the builder (which sets an accent) opts out of this and is fully data-driven.
type LegacyStyle = {
  label: string;
  emoji: string;
  accent: string;
  highlight: { big: string; sub: string };
  terms: string[];
};

const LEGACY_STYLES: { match: string; style: LegacyStyle }[] = [
  {
    match: "10% off your next stay",
    style: { label: "Returning Guest", emoji: "🌿", accent: "emerald", highlight: { big: "10%", sub: "off your next stay" }, terms: ["Any future reservation", "No minimum stay", "Direct bookings only"] },
  },
  {
    match: "20% off at archie's corner",
    style: { label: "Community Perk", emoji: "🛒", accent: "orange", highlight: { big: "20% Off", sub: "everything in store" }, terms: ["Show booking confirmation at checkout", "Snacks, firewood, ice & essentials", "Near the main clubhouse"] },
  },
  {
    match: "book 2 weeknights, get the 3rd free",
    style: { label: "Midweek Escape", emoji: "🌙", accent: "indigo", highlight: { big: "3rd Night", sub: "completely free" }, terms: ["Sunday – Thursday stays", "Holiday weeks excluded", "Direct bookings only"] },
  },
  {
    match: "free birthday night",
    style: { label: "Birthday Celebration", emoji: "🎂", accent: "rose", highlight: { big: "Free Night", sub: "on your special day" }, terms: ["Weekdays only (Sun–Thu)", "Minimum 2-night stay", "Mention birthday guest when booking"] },
  },
  {
    match: "no cleaning fee on extended stays",
    style: { label: "Extended Stay", emoji: "✨", accent: "amber", highlight: { big: "$0", sub: "cleaning fee" }, terms: ["6+ consecutive nights", "Any property, any season", "Direct bookings only"] },
  },
];

function legacyStyleFor(promo: Promo): LegacyStyle | null {
  // Only for untouched migrated rows: no configured offers and no accent.
  if (promo.offers.length > 0 || promo.accent) return null;
  const title = (promo.title ?? "").trim().toLowerCase();
  return LEGACY_STYLES.find((s) => title === s.match)?.style ?? null;
}

function PromoCodeChip({ code, accent }: { code: string; accent: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className={`group/code inline-flex items-center gap-2.5 rounded-full border border-dashed px-4 py-2 transition-all hover:scale-[1.02] active:scale-[0.98] ${accent}`}
    >
      <span className="text-xs font-semibold uppercase tracking-[0.2em] opacity-50">Use code</span>
      <span className="font-mono text-sm font-bold tracking-[0.12em]">{code}</span>
      {copied ? (
        <Check className="h-3.5 w-3.5 opacity-60" />
      ) : (
        <Copy className="h-3.5 w-3.5 opacity-30 transition-opacity group-hover/code:opacity-60" />
      )}
    </button>
  );
}

function PromotionCard({ promo, index, total }: { promo: Promo; index: number; total: number }) {
  const legacy = legacyStyleFor(promo);
  const c = accentOf(legacy?.accent ?? promo.accent);
  const emoji = legacy?.emoji ?? promo.emoji ?? "🎁";
  const highlight = legacy?.highlight ?? headlineFromOffers(promo.offers);
  // Pills: host fine print if provided, otherwise legacy terms or the offer list.
  const offerPills = promo.offers.filter((o) => o.kind !== "perk").map(offerLabel);
  const perkPills = promo.offers.filter((o) => o.kind === "perk").map(offerLabel);
  const pills = promo.terms.length
    ? promo.terms
    : legacy?.terms ?? (offerPills.length ? offerPills : ["Direct bookings only"]);
  const label = legacy?.label ?? (promo.featured ? "Featured" : "Guest Exclusive");

  return (
    <article
      className={`group relative overflow-hidden rounded-2xl border ${c.border} ${c.bg} transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md`}
    >
      <div className="relative p-6 sm:p-8">
        {/* Top label row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">{emoji}</span>
            <span className={`text-xs font-bold uppercase tracking-[0.25em] ${c.muted}`}>{label}</span>
          </div>
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/40">
            {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </span>
        </div>

        {/* Main grid */}
        <div className="mt-6 grid gap-6 sm:grid-cols-[1fr_auto] sm:gap-8">
          <div className="space-y-3">
            <h3
              className="text-[1.65rem] font-normal leading-tight tracking-tight sm:text-3xl"
              style={{ fontFamily: "var(--font-playfair), serif" }}
            >
              {promo.title || "Guest Offer"}
            </h3>

            {promo.description && (
              <p className="max-w-lg text-[0.875rem] leading-relaxed text-muted-foreground">{promo.description}</p>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              {pills.map((term, i) => (
                <span
                  key={i}
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ${c.chip} ${c.muted}`}
                >
                  {term}
                </span>
              ))}
              {perkPills.map((perk, i) => (
                <span
                  key={`perk-${i}`}
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ${c.chip} ${c.muted}`}
                >
                  🎁 {perk}
                </span>
              ))}
            </div>
          </div>

          {highlight && (
            <div className="flex items-center">
              <div className={`flex flex-col items-center rounded-xl border border-dashed px-5 py-4 text-center sm:px-7 sm:py-5 ${c.border}`}>
                <span
                  className={`text-3xl font-normal tracking-tight sm:text-4xl ${c.text}`}
                  style={{ fontFamily: "var(--font-playfair), serif" }}
                >
                  {highlight.big}
                </span>
                <span className={`mt-0.5 text-[11px] font-medium uppercase tracking-[0.15em] ${c.muted}`}>
                  {highlight.sub}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Bottom: code / CTA */}
        <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-foreground/5 pt-5">
          {promo.code ? (
            <>
              <PromoCodeChip code={promo.code} accent={c.border} />
              <a
                href={BOOKING_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] transition-opacity hover:opacity-70 ${c.text}`}
              >
                Book Direct
                <ArrowUpRight className="h-3 w-3" />
              </a>
            </>
          ) : (
            <span className={`text-[11px] font-bold uppercase tracking-[0.2em] ${c.muted}`}>
              {promo.auto_apply ? "Automatic — applied at checkout" : "No code needed — just show your reservation"}
            </span>
          )}
        </div>

        {(promo.valid_from || promo.valid_until) && (
          <p className="mt-3 text-[11px] tracking-wide text-muted-foreground/40">
            {promo.valid_from &&
              `From ${new Date(promo.valid_from).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`}
            {promo.valid_from && promo.valid_until && " — "}
            {promo.valid_until &&
              `Until ${new Date(promo.valid_until).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`}
          </p>
        )}
      </div>
    </article>
  );
}

export function PromotionCards({ promotions }: { promotions: Promo[] }) {
  return (
    <div className="space-y-4">
      {promotions.map((promo, i) => (
        <PromotionCard key={promo.id} promo={promo} index={i} total={promotions.length} />
      ))}

      <p className="pt-4 text-center text-[11px] leading-relaxed tracking-wide text-muted-foreground/40">
        All offers exclusive to direct bookings at summitlakeside.com
        <span className="mx-2 text-foreground/10">·</span>
        Some offers cannot be combined
      </p>
    </div>
  );
}
