"use client";

import { useState } from "react";
import { Copy, Check, ArrowUpRight } from "lucide-react";
import type { Database } from "@/types/database";

type Promotion = Database["public"]["Tables"]["promotion"]["Row"];

const BOOKING_URL = "https://summitlakeside.com";

type PromoStyle = {
  label: string;
  highlight: string;
  terms: string[];
};

const promoStyles: Record<string, PromoStyle> = {
  COMEBACK10: {
    label: "Returning Guest",
    highlight: "10% Off",
    terms: [
      "Any future reservation",
      "No minimum stay",
      "Direct bookings only",
    ],
  },
  WEEKNIGHT3: {
    label: "Midweek Escape",
    highlight: "3rd Night Free",
    terms: [
      "Sunday – Thursday stays",
      "Holiday weeks excluded",
      "Direct bookings only",
    ],
  },
  LONGSTAY: {
    label: "Extended Stay",
    highlight: "No Cleaning Fee",
    terms: [
      "6+ consecutive nights",
      "Any property, any season",
      "Direct bookings only",
    ],
  },
  BIRTHDAY: {
    label: "Birthday",
    highlight: "Free Night",
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
  return { label: "Exclusive", highlight: "", terms: [] };
}

function PromoCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="group/code relative inline-flex items-center gap-3 border-b border-foreground/10 pb-1 transition-colors hover:border-foreground/30"
    >
      <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
        Code
      </span>
      <span className="font-mono text-sm font-semibold tracking-[0.15em]">
        {code}
      </span>
      {copied ? (
        <Check className="h-3 w-3 text-foreground/60" />
      ) : (
        <Copy className="h-3 w-3 text-foreground/20 transition-colors group-hover/code:text-foreground/60" />
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
    <article className="group relative">
      {/* Top rule */}
      <div className="h-px w-full bg-foreground/6" />

      <div className="grid gap-6 py-8 sm:grid-cols-[1fr_auto] sm:gap-10">
        {/* Left: content */}
        <div className="space-y-4">
          {/* Label + number */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-medium uppercase tracking-[0.3em] text-muted-foreground">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="h-px w-4 bg-foreground/20" />
            <span className="text-[10px] font-medium uppercase tracking-[0.3em] text-muted-foreground">
              {style.label}
            </span>
          </div>

          {/* Title */}
          <h3
            className="text-2xl font-normal tracking-tight sm:text-3xl"
            style={{ fontFamily: "var(--font-playfair), serif" }}
          >
            {promo.title}
          </h3>

          {/* Description */}
          {promo.description && (
            <p className="max-w-xl text-[0.9rem] leading-relaxed text-muted-foreground">
              {promo.description}
            </p>
          )}

          {/* Terms */}
          {style.terms.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
              {style.terms.map((term, i) => (
                <span
                  key={i}
                  className="text-xs text-muted-foreground/70"
                >
                  {i > 0 && (
                    <span className="mr-4 text-foreground/10">·</span>
                  )}
                  {term}
                </span>
              ))}
            </div>
          )}

          {/* Code + Book link */}
          <div className="flex flex-wrap items-center gap-6 pt-2">
            {promo.promo_code && <PromoCode code={promo.promo_code} />}

            {promo.promo_code && (
              <a
                href={BOOKING_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.15em] text-foreground/50 transition-colors hover:text-foreground"
              >
                Book Now
                <ArrowUpRight className="h-3 w-3" />
              </a>
            )}
          </div>

          {/* Validity */}
          {(promo.valid_from || promo.valid_until) && (
            <p className="pt-1 text-[11px] tracking-wide text-muted-foreground/50">
              {promo.valid_from &&
                `From ${new Date(promo.valid_from).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`}
              {promo.valid_from && promo.valid_until && " — "}
              {promo.valid_until &&
                `Until ${new Date(promo.valid_until).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`}
            </p>
          )}
        </div>

        {/* Right: highlight callout */}
        {style.highlight && (
          <div className="flex items-start sm:items-center sm:justify-end">
            <div className="inline-flex flex-col items-center rounded-none border border-foreground/8 px-6 py-4 text-center sm:px-8 sm:py-6">
              <span className="text-[10px] font-medium uppercase tracking-[0.3em] text-muted-foreground">
                {promo.promo_code ? "You Save" : "Discount"}
              </span>
              <span
                className="mt-1 text-2xl font-normal tracking-tight sm:text-3xl"
                style={{ fontFamily: "var(--font-playfair), serif" }}
              >
                {style.highlight}
              </span>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

export function PromotionCards({ promotions }: { promotions: Promotion[] }) {
  return (
    <div>
      {promotions.map((promo, i) => (
        <PromotionCard key={promo.id} promo={promo} index={i} />
      ))}
      {/* Bottom rule */}
      <div className="h-px w-full bg-foreground/6" />

      {/* Footer note */}
      <p className="mt-8 text-center text-xs leading-relaxed text-muted-foreground/50">
        All offers are exclusive to direct bookings at summitlakeside.com
        <br />
        Cannot be combined with other promotions unless stated otherwise.
      </p>
    </div>
  );
}
