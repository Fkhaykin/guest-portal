"use client";

import { useState } from "react";
import { Copy, Check, ArrowUpRight } from "lucide-react";
import type { Database } from "@/types/database";

type Promotion = Database["public"]["Tables"]["promotion"]["Row"];

const BOOKING_URL = "https://summitlakeside.com";

type PromoStyle = {
  label: string;
  highlight: string;
  highlightSub: string;
  accent: string;
  accentMuted: string;
  accentBorder: string;
  accentBg: string;
  darkAccentBg: string;
  emoji: string;
  terms: string[];
};

const promoStyles: Record<string, PromoStyle> = {
  COMEBACK10: {
    label: "Returning Guest",
    highlight: "10%",
    highlightSub: "off your next stay",
    accent: "text-emerald-700 dark:text-emerald-400",
    accentMuted: "text-emerald-600/70 dark:text-emerald-400/70",
    accentBorder: "border-emerald-200 dark:border-emerald-800/50",
    accentBg: "bg-emerald-50 dark:bg-emerald-950/30",
    darkAccentBg: "bg-emerald-100 dark:bg-emerald-900/40",
    emoji: "🌿",
    terms: [
      "Any future reservation",
      "No minimum stay",
      "Direct bookings only",
    ],
  },
  WEEKNIGHT3: {
    label: "Midweek Escape",
    highlight: "3rd Night",
    highlightSub: "completely free",
    accent: "text-indigo-700 dark:text-indigo-400",
    accentMuted: "text-indigo-600/70 dark:text-indigo-400/70",
    accentBorder: "border-indigo-200 dark:border-indigo-800/50",
    accentBg: "bg-indigo-50 dark:bg-indigo-950/30",
    darkAccentBg: "bg-indigo-100 dark:bg-indigo-900/40",
    emoji: "🌙",
    terms: [
      "Sunday – Thursday stays",
      "Holiday weeks excluded",
      "Direct bookings only",
    ],
  },
  LONGSTAY: {
    label: "Extended Stay",
    highlight: "$0",
    highlightSub: "cleaning fee",
    accent: "text-amber-700 dark:text-amber-400",
    accentMuted: "text-amber-600/70 dark:text-amber-400/70",
    accentBorder: "border-amber-200 dark:border-amber-800/50",
    accentBg: "bg-amber-50 dark:bg-amber-950/30",
    darkAccentBg: "bg-amber-100 dark:bg-amber-900/40",
    emoji: "✨",
    terms: [
      "6+ consecutive nights",
      "Any property, any season",
      "Direct bookings only",
    ],
  },
  BIRTHDAY: {
    label: "Birthday Celebration",
    highlight: "Free Night",
    highlightSub: "on your special day",
    accent: "text-rose-700 dark:text-rose-400",
    accentMuted: "text-rose-600/70 dark:text-rose-400/70",
    accentBorder: "border-rose-200 dark:border-rose-800/50",
    accentBg: "bg-rose-50 dark:bg-rose-950/30",
    darkAccentBg: "bg-rose-100 dark:bg-rose-900/40",
    emoji: "🎂",
    terms: [
      "Weekdays only (Sun–Thu)",
      "Minimum 2-night stay",
      "Mention birthday guest when booking",
    ],
  },
};

const archiesStyle: PromoStyle = {
  label: "Community Perk",
  highlight: "20% Off",
  highlightSub: "everything in store",
  accent: "text-orange-700 dark:text-orange-400",
  accentMuted: "text-orange-600/70 dark:text-orange-400/70",
  accentBorder: "border-orange-200 dark:border-orange-800/50",
  accentBg: "bg-orange-50 dark:bg-orange-950/30",
  darkAccentBg: "bg-orange-100 dark:bg-orange-900/40",
  emoji: "🛒",
  terms: [
    "Show booking confirmation at checkout",
    "Snacks, firewood, ice & essentials",
    "Near the main clubhouse",
  ],
};

function getStyle(promo: Promotion): PromoStyle {
  if (promo.promo_code && promoStyles[promo.promo_code])
    return promoStyles[promo.promo_code];
  if (promo.title.toLowerCase().includes("archie")) return archiesStyle;
  return {
    ...archiesStyle,
    label: "Exclusive",
    highlight: "",
    highlightSub: "",
    emoji: "🎁",
  };
}

function PromoCode({ code, accent }: { code: string; accent: string }) {
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
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] opacity-50">
        Use code
      </span>
      <span className="font-mono text-sm font-bold tracking-[0.12em]">
        {code}
      </span>
      {copied ? (
        <Check className="h-3.5 w-3.5 opacity-60" />
      ) : (
        <Copy className="h-3.5 w-3.5 opacity-30 transition-opacity group-hover/code:opacity-60" />
      )}
    </button>
  );
}

function PromotionCard({
  promo,
  index,
}: {
  promo: Promotion;
  index: number;
}) {
  const style = getStyle(promo);

  return (
    <article
      className={`group relative overflow-hidden rounded-2xl border ${style.accentBorder} ${style.accentBg} transition-all duration-300 hover:shadow-md`}
    >
      <div className="relative p-6 sm:p-8">
        {/* Top: label row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">{style.emoji}</span>
            <span
              className={`text-[10px] font-bold uppercase tracking-[0.25em] ${style.accentMuted}`}
            >
              {style.label}
            </span>
          </div>
          <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/40">
            {String(index + 1).padStart(2, "0")} / 05
          </span>
        </div>

        {/* Main content grid */}
        <div className="mt-6 grid gap-6 sm:grid-cols-[1fr_auto] sm:gap-8">
          {/* Left: text content */}
          <div className="space-y-3">
            <h3
              className="text-[1.65rem] font-normal leading-tight tracking-tight sm:text-3xl"
              style={{ fontFamily: "var(--font-playfair), serif" }}
            >
              {promo.title}
            </h3>

            {promo.description && (
              <p className="max-w-lg text-[0.875rem] leading-relaxed text-muted-foreground">
                {promo.description}
              </p>
            )}

            {/* Terms as inline pills */}
            <div className="flex flex-wrap gap-2 pt-2">
              {style.terms.map((term, i) => (
                <span
                  key={i}
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ${style.darkAccentBg} ${style.accentMuted}`}
                >
                  {term}
                </span>
              ))}
            </div>
          </div>

          {/* Right: highlight badge */}
          {style.highlight && (
            <div className="flex items-center">
              <div
                className={`flex flex-col items-center rounded-xl border border-dashed px-5 py-4 text-center sm:px-7 sm:py-5 ${style.accentBorder}`}
              >
                <span
                  className={`text-3xl font-normal tracking-tight sm:text-4xl ${style.accent}`}
                  style={{ fontFamily: "var(--font-playfair), serif" }}
                >
                  {style.highlight}
                </span>
                <span
                  className={`mt-0.5 text-[11px] font-medium uppercase tracking-[0.15em] ${style.accentMuted}`}
                >
                  {style.highlightSub}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Bottom: code + CTA */}
        <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-foreground/5 pt-5">
          {promo.promo_code && (
            <PromoCode code={promo.promo_code} accent={style.accentBorder} />
          )}

          {promo.promo_code ? (
            <a
              href={BOOKING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] transition-opacity hover:opacity-70 ${style.accent}`}
            >
              Book Direct
              <ArrowUpRight className="h-3 w-3" />
            </a>
          ) : (
            <span
              className={`text-[11px] font-bold uppercase tracking-[0.2em] ${style.accentMuted}`}
            >
              No code needed — just show your reservation
            </span>
          )}
        </div>

        {/* Validity */}
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

export function PromotionCards({ promotions }: { promotions: Promotion[] }) {
  return (
    <div className="space-y-4">
      {promotions.map((promo, i) => (
        <PromotionCard key={promo.id} promo={promo} index={i} />
      ))}

      <p className="pt-4 text-center text-[11px] leading-relaxed tracking-wide text-muted-foreground/40">
        All offers exclusive to direct bookings at summitlakeside.com
        <span className="mx-2 text-foreground/10">·</span>
        Cannot be combined with other promotions
      </p>
    </div>
  );
}
