"use client";

import { useState } from "react";
import {
  Percent,
  Moon,
  SparklesIcon,
  Cake,
  ShoppingBag,
  Copy,
  Check,
  ExternalLink,
  Clock,
  Info,
  Gift,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Database } from "@/types/database";

type Promotion = Database["public"]["Tables"]["promotion"]["Row"];

const BOOKING_URL = "https://summitlakeside.com";

// Visual config per promo code for rich, distinct card styles
const promoConfig: Record<
  string,
  {
    icon: React.ReactNode;
    gradient: string;
    iconBg: string;
    accentColor: string;
    tagLine: string;
    details: string[];
    ctaText: string;
  }
> = {
  COMEBACK10: {
    icon: <Percent className="h-6 w-6" />,
    gradient:
      "from-emerald-500/10 via-emerald-500/5 to-transparent dark:from-emerald-500/20 dark:via-emerald-500/10",
    iconBg:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400",
    accentColor: "text-emerald-600 dark:text-emerald-400",
    tagLine: "Your loyalty deserves a reward",
    details: [
      "Valid on any future reservation",
      "No minimum nights required",
      "Book direct at summitlakeside.com",
      "Cannot be combined with other offers",
    ],
    ctaText: "Book Your Next Stay",
  },
  WEEKNIGHT3: {
    icon: <Moon className="h-6 w-6" />,
    gradient:
      "from-violet-500/10 via-violet-500/5 to-transparent dark:from-violet-500/20 dark:via-violet-500/10",
    iconBg:
      "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-400",
    accentColor: "text-violet-600 dark:text-violet-400",
    tagLine: "Midweek escapes just got better",
    details: [
      "Stay any Sunday through Thursday",
      "3rd weeknight is completely free",
      "Excludes holiday weeks",
      "Book direct at summitlakeside.com",
    ],
    ctaText: "Plan a Weeknight Getaway",
  },
  LONGSTAY: {
    icon: <SparklesIcon className="h-6 w-6" />,
    gradient:
      "from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-500/20 dark:via-amber-500/10",
    iconBg:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400",
    accentColor: "text-amber-600 dark:text-amber-400",
    tagLine: "Stay longer, save more",
    details: [
      "Book 6 or more consecutive nights",
      "Cleaning fee fully waived",
      "Applies to any property",
      "Book direct at summitlakeside.com",
    ],
    ctaText: "Book an Extended Stay",
  },
  BIRTHDAY: {
    icon: <Cake className="h-6 w-6" />,
    gradient:
      "from-pink-500/10 via-pink-500/5 to-transparent dark:from-pink-500/20 dark:via-pink-500/10",
    iconBg:
      "bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-400",
    accentColor: "text-pink-600 dark:text-pink-400",
    tagLine: "Celebrate your special day with us",
    details: [
      "One free night on your birthday stay",
      "Weekdays only (Sun–Thu)",
      "Must book at least 2 nights",
      "Mention the birthday guest's name when booking",
    ],
    ctaText: "Book a Birthday Getaway",
  },
};

// Default config for promos without a specific code
const defaultConfig = {
  icon: <Gift className="h-6 w-6" />,
  gradient:
    "from-sky-500/10 via-sky-500/5 to-transparent dark:from-sky-500/20 dark:via-sky-500/10",
  iconBg: "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-400",
  accentColor: "text-sky-600 dark:text-sky-400",
  tagLine: "An exclusive perk for our guests",
  details: [],
  ctaText: "Learn More",
};

// Special config for the Archie's Corner promo (no code)
const archiesConfig = {
  icon: <ShoppingBag className="h-6 w-6" />,
  gradient:
    "from-orange-500/10 via-orange-500/5 to-transparent dark:from-orange-500/20 dark:via-orange-500/10",
  iconBg:
    "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400",
  accentColor: "text-orange-600 dark:text-orange-400",
  tagLine: "Your neighborhood convenience store",
  details: [
    "Show your booking confirmation at checkout",
    "Snacks, drinks, ice, firewood, charcoal & more",
    "Located near the main clubhouse in Penn Estates",
    "No promo code needed — just show your reservation",
  ],
  ctaText: "",
};

function getConfig(promo: Promotion) {
  if (promo.promo_code && promoConfig[promo.promo_code]) {
    return promoConfig[promo.promo_code];
  }
  if (promo.title.toLowerCase().includes("archie")) {
    return archiesConfig;
  }
  return defaultConfig;
}

function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="group/copy inline-flex items-center gap-2 rounded-lg border border-dashed border-foreground/20 bg-muted/50 px-4 py-2.5 font-mono text-base font-bold tracking-widest transition-all hover:border-foreground/40 hover:bg-muted active:scale-[0.98]"
    >
      <span>{code}</span>
      {copied ? (
        <Check className="h-4 w-4 text-emerald-500" />
      ) : (
        <Copy className="h-4 w-4 text-muted-foreground transition-colors group-hover/copy:text-foreground" />
      )}
    </button>
  );
}

function PromotionCard({ promo }: { promo: Promotion }) {
  const config = getConfig(promo);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="group relative overflow-hidden rounded-2xl border bg-card transition-all hover:shadow-lg">
      {/* Gradient accent background */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${config.gradient} pointer-events-none`}
      />

      <div className="relative p-5 sm:p-6">
        {/* Header row */}
        <div className="flex items-start gap-4">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${config.iconBg} transition-transform group-hover:scale-110`}
          >
            {config.icon}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold leading-tight">{promo.title}</h3>
            <p className={`mt-0.5 text-sm font-medium ${config.accentColor}`}>
              {config.tagLine}
            </p>
          </div>
        </div>

        {/* Description */}
        {promo.description && (
          <p className="mt-4 text-[0.925rem] leading-relaxed text-muted-foreground">
            {promo.description}
          </p>
        )}

        {/* Promo code + CTA row */}
        {(promo.promo_code || config.ctaText) && (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {promo.promo_code && <CopyCodeButton code={promo.promo_code} />}
            {config.ctaText && (
              <Button variant="default" size="sm" render={<a href={BOOKING_URL} target="_blank" rel="noopener noreferrer" />}>
                {config.ctaText}
                <ExternalLink data-icon="inline-end" className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}

        {/* Expandable details */}
        {config.details.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setExpanded(!expanded)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <Info className="h-3.5 w-3.5" />
              {expanded ? "Hide details" : "How it works"}
            </button>
            {expanded && (
              <ul className="mt-3 space-y-2">
                {config.details.map((detail, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2.5 text-sm text-muted-foreground"
                  >
                    <Check
                      className={`mt-0.5 h-4 w-4 shrink-0 ${config.accentColor}`}
                    />
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Validity badges */}
        {(promo.valid_from || promo.valid_until) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {promo.valid_from && (
              <Badge variant="outline" className="gap-1">
                <Clock className="h-3 w-3" />
                Starts{" "}
                {new Date(promo.valid_from).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </Badge>
            )}
            {promo.valid_until && (
              <Badge variant="outline" className="gap-1">
                <Clock className="h-3 w-3" />
                Expires{" "}
                {new Date(promo.valid_until).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function PromotionCards({ promotions }: { promotions: Promotion[] }) {
  return (
    <div className="grid gap-4">
      {promotions.map((promo) => (
        <PromotionCard key={promo.id} promo={promo} />
      ))}
    </div>
  );
}
