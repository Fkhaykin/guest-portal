"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Loader2,
  CalendarDays,
  Gauge,
  Timer,
  SlidersHorizontal,
  DollarSign,
  Check,
} from "lucide-react";
import type { PricingConfig } from "./types";
import type { PricingRules } from "@/lib/pricing/engine";
import { CUSTOMIZATION_ITEMS } from "./customization-items";

// Logical sections group the (otherwise flat) customization list into the way
// an operator thinks about pricing: what shapes the base through the calendar,
// what reacts to demand, what reacts to lead time, and the stay/override rules.
const SECTIONS: { title: string; blurb: string; icon: typeof CalendarDays; keys: string[] }[] = [
  {
    title: "Seasonality & calendar",
    blurb: "How the base price moves through the year and the week.",
    icon: CalendarDays,
    keys: ["seasons", "holidays", "events", "dow"],
  },
  {
    title: "Demand signals",
    blurb: "Adjustments that react to the market and the forecast.",
    icon: Gauge,
    keys: ["demand", "velocity", "pace", "weather"],
  },
  {
    title: "Lead time & gaps",
    blurb: "How price shifts as check-in nears and around orphan nights.",
    icon: Timer,
    keys: ["last-minute", "far-out", "orphan"],
  },
  {
    title: "Stay rules & overrides",
    blurb: "Minimum-stay logic, date overrides, and adjacent-night smoothing.",
    icon: SlidersHorizontal,
    keys: ["min-stay", "overrides", "smoothing"],
  },
];

export function ConfigEditor({
  config,
  onSave,
  saving,
}: {
  config: PricingConfig;
  onSave: (patch: Partial<PricingConfig>) => void;
  saving: boolean;
}) {
  const [base, setBase] = useState(String(Math.round(config.base_price_cents / 100)));
  const [min, setMin] = useState(String(Math.round(config.min_price_cents / 100)));
  const [max, setMax] = useState(String(Math.round(config.max_price_cents / 100)));
  const [rules, setRules] = useState<PricingRules>(config.rules);

  const itemByKey = useMemo(() => new Map(CUSTOMIZATION_ITEMS.map((it) => [it.key, it])), []);
  const activeCount = useMemo(
    () => CUSTOMIZATION_ITEMS.filter((it) => it.applied(rules)).length,
    [rules]
  );

  const dirty = useMemo(() => {
    const b = Math.round(parseFloat(base || "0") * 100);
    const mn = Math.round(parseFloat(min || "0") * 100);
    const mx = Math.round(parseFloat(max || "0") * 100);
    return (
      b !== config.base_price_cents ||
      mn !== config.min_price_cents ||
      mx !== config.max_price_cents ||
      JSON.stringify(rules) !== JSON.stringify(config.rules)
    );
  }, [base, min, max, rules, config]);

  function save() {
    onSave({
      base_price_cents: Math.round(parseFloat(base) * 100),
      min_price_cents: Math.round(parseFloat(min) * 100),
      max_price_cents: Math.round(parseFloat(max) * 100),
      rules: {
        ...rules,
        seasons: (rules.seasons ?? []).filter((s) => s.from && s.to),
        events: (rules.events ?? []).filter((e) => e.from && e.to),
        overrides: (rules.overrides ?? []).filter((o) => o.date),
        minStay: { ...rules.minStay, seasons: (rules.minStay?.seasons ?? []).filter((s) => s.from && s.to) },
      },
    });
  }

  return (
    <div className="space-y-8 pb-24">
      {/* Price anchors */}
      <section>
        <SectionHead icon={DollarSign} title="Price anchors" blurb="The base every factor multiplies, and the floor/ceiling it can never cross." />
        <Card className="border-border/70">
          <CardContent className="grid gap-4 pt-5 sm:grid-cols-3">
            <MoneyField label="Base price" hint="Neutral night, before any factor" value={base} onChange={setBase} emphasis />
            <MoneyField label="Floor" hint="Never price below this" value={min} onChange={setMin} />
            <MoneyField label="Ceiling" hint="Never price above this" value={max} onChange={setMax} />
          </CardContent>
        </Card>
      </section>

      {SECTIONS.map((section) => {
        const items = section.keys.map((k) => itemByKey.get(k)).filter((x): x is NonNullable<typeof x> => !!x);
        if (!items.length) return null;
        return (
          <section key={section.title}>
            <SectionHead icon={section.icon} title={section.title} blurb={section.blurb} />
            <div className="space-y-3">
              {items.map((it) => {
                const on = it.applied(rules);
                return (
                  <Card key={it.key} className={`overflow-hidden border-border/70 transition-colors ${on ? "" : "bg-muted/20"}`}>
                    <div className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-3.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold">{it.title}</h4>
                          <StatusPill on={on} />
                        </div>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{it.explainer}</p>
                        <p className="mt-1.5 text-[13px] font-medium text-foreground/90">{it.summary(rules)}</p>
                      </div>
                    </div>
                    <CardContent className="px-5 py-4">
                      <it.Editor rules={rules} onChange={setRules} />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* Sticky save bar */}
      <div className="pointer-events-none sticky bottom-4 z-20 flex justify-end">
        <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-border bg-card/95 py-1.5 pl-4 pr-1.5 shadow-lg backdrop-blur">
          <span className="text-xs text-muted-foreground">
            {activeCount} factor{activeCount === 1 ? "" : "s"} on
            {dirty && <span className="ml-2 font-medium text-amber-600 dark:text-amber-400">· unsaved changes</span>}
          </span>
          <Button onClick={save} disabled={saving || !dirty} size="sm" className="rounded-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Save &amp; refresh
          </Button>
        </div>
      </div>
    </div>
  );
}

function SectionHead({ icon: Icon, title, blurb }: { icon: typeof CalendarDays; title: string; blurb: string }) {
  return (
    <div className="mb-3 flex items-start gap-2.5">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        <p className="text-xs text-muted-foreground">{blurb}</p>
      </div>
    </div>
  );
}

function StatusPill({ on }: { on: boolean }) {
  return on ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600/12 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> On
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      Off
    </span>
  );
}

function MoneyField({
  label,
  hint,
  value,
  onChange,
  emphasis,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  emphasis?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
        <Input
          type="number"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`h-10 pl-7 tabular-nums ${emphasis ? "text-base font-semibold" : "font-medium"}`}
        />
      </div>
      {hint && <p className="text-[11px] leading-tight text-muted-foreground">{hint}</p>}
    </div>
  );
}
