"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Pencil, Check, Plus } from "lucide-react";
import type { PricingConfig, PricingLabData } from "./types";
import { CUSTOMIZATION_ITEMS, appliedCount } from "./customization-items";
import { HelpMeChooseBase } from "./base-price-helper";

/** Left rail: Min / Base / Max quick edit + an applied-customizations summary,
 *  matching PriceLabs' "Configure Prices" sidebar. */
export function ConfigureRail({
  config,
  data,
  onSave,
  onEdit,
  saving,
}: {
  config: PricingConfig;
  data: PricingLabData;
  onSave: (patch: Partial<PricingConfig>) => void;
  onEdit: () => void;
  saving: boolean;
}) {
  const [min, setMin] = useState(String(Math.round(config.min_price_cents / 100)));
  const [base, setBase] = useState(String(Math.round(config.base_price_cents / 100)));
  const [max, setMax] = useState(String(Math.round(config.max_price_cents / 100)));

  const valid =
    Number(min) > 0 && Number(base) > 0 && Number(max) > 0 && Number(min) <= Number(max);
  const dirty =
    valid &&
    (Math.round(config.min_price_cents / 100) !== Number(min) ||
      Math.round(config.base_price_cents / 100) !== Number(base) ||
      Math.round(config.max_price_cents / 100) !== Number(max));

  const rules = config.rules;
  // Registry-driven: show applied customizations with their plain-English
  // summaries (a couple of key non-applied ones too so they're discoverable).
  const applied = CUSTOMIZATION_ITEMS.filter((it) => it.applied(rules));
  const shown = applied.length ? applied : CUSTOMIZATION_ITEMS.slice(0, 4);
  const total = appliedCount(rules);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Configure Prices</span>
            <span className="text-xs text-muted-foreground">USD</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <PriceField label="Minimum" value={min} onChange={setMin} />
            <PriceField label="Base" value={base} onChange={setBase} />
            <PriceField label="Maximum" value={max} onChange={setMax} />
          </div>
          <HelpMeChooseBase data={data} onPick={(v) => setBase(String(v))} />
          <Button
            className="w-full"
            disabled={!dirty || saving}
            onClick={() =>
              onSave({
                min_price_cents: Math.round(Number(min) * 100),
                base_price_cents: Math.round(Number(base) * 100),
                max_price_cents: Math.round(Number(max) * 100),
              })
            }
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save & Refresh
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Applied Customizations</span>
              <span className="rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground">{total}</span>
            </div>
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          </div>
          <div className="space-y-2.5">
            {shown.map((it) => (
              <button key={it.key} onClick={onEdit} className="block w-full text-left">
                <div className="flex items-center gap-1 text-xs font-medium">
                  {it.applied(rules) && <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />}
                  {it.title}
                </div>
                <div className="text-xs text-muted-foreground">{it.summary(rules)}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PriceField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-9 px-2 text-sm" inputMode="numeric" />
    </div>
  );
}

/** Right rail: Listing Metrics + Date Overrides + Events, matching PriceLabs'
 *  calendar right rail. Overrides/Events open the Customizations modal to
 *  their page for editing. */
export function MetricsRail({
  data,
  onEditRule,
}: {
  data: PricingLabData;
  onEditRule: (key: string) => void;
}) {
  const rows = [
    { label: "Next 7 days", value: data.metrics.occ7 },
    { label: "Next 30 days", value: data.metrics.occ30 },
    { label: "Next 60 days", value: data.metrics.occ60 },
  ];
  const overrides = data.config.rules.overrides?.length ?? 0;
  const events = data.config.rules.events?.length ?? 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4">
          <span className="text-sm font-semibold">Listing Metrics</span>
          <div className="space-y-2.5">
            {rows.map((r) => (
              <div key={r.label} className="flex items-center justify-between">
                <div className="text-xs">
                  <div className="font-medium">Total Occupancy</div>
                  <div className="text-muted-foreground">{r.label}</div>
                </div>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-sm font-semibold tabular-nums">
                  {r.value}%
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="divide-y divide-border p-0 text-sm">
          <RailRow label="Date Overrides" count={overrides} onClick={() => onEditRule("overrides")} />
          <RailRow label="Event / Holidays" count={events} onClick={() => onEditRule("events")} />
        </CardContent>
      </Card>
    </div>
  );
}

function RailRow({ label, count, onClick }: { label: string; count: number; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/50">
      <span className="flex items-center gap-2">
        {label}
        {count > 0 && <span className="rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground">{count}</span>}
      </span>
      <Plus className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}
