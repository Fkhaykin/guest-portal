"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Pencil, Check } from "lucide-react";
import type { PricingConfig, PricingLabData } from "./types";
import { CustomizationsModal } from "./customizations-modal";
import { CUSTOMIZATION_ITEMS, appliedCount } from "./customization-items";

/** Left rail: Min / Base / Max quick edit + an applied-customizations summary,
 *  matching PriceLabs' "Configure Prices" sidebar. */
export function ConfigureRail({
  config,
  data,
  onSave,
  saving,
}: {
  config: PricingConfig;
  data: PricingLabData;
  onSave: (patch: Partial<PricingConfig>) => void;
  saving: boolean;
}) {
  const [min, setMin] = useState(String(Math.round(config.min_price_cents / 100)));
  const [base, setBase] = useState(String(Math.round(config.base_price_cents / 100)));
  const [max, setMax] = useState(String(Math.round(config.max_price_cents / 100)));
  const [editOpen, setEditOpen] = useState(false);

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
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          </div>
          <div className="space-y-2.5">
            {shown.map((it) => (
              <button
                key={it.key}
                onClick={() => setEditOpen(true)}
                className="block w-full text-left"
              >
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

      <CustomizationsModal
        open={editOpen}
        onOpenChange={setEditOpen}
        config={config}
        data={data}
        onSave={onSave}
        saving={saving}
      />
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

/** Right rail: occupancy metrics, matching PriceLabs' "Listing Metrics". */
export function MetricsRail({ metrics }: { metrics: PricingLabData["metrics"] }) {
  const rows = [
    { label: "Next 7 days", value: metrics.occ7 },
    { label: "Next 30 days", value: metrics.occ30 },
    { label: "Next 60 days", value: metrics.occ60 },
  ];
  return (
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
  );
}
