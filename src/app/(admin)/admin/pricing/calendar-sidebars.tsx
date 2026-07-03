"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import type { PricingConfig, PricingLabData } from "./types";

/** Left rail: Min / Base / Max quick edit + an applied-customizations summary,
 *  matching PriceLabs' "Configure Prices" sidebar. */
export function ConfigureRail({
  config,
  onSave,
  saving,
}: {
  config: PricingConfig;
  onSave: (patch: Partial<PricingConfig>) => void;
  saving: boolean;
}) {
  const [min, setMin] = useState(String(Math.round(config.min_price_cents / 100)));
  const [base, setBase] = useState(String(Math.round(config.base_price_cents / 100)));
  const [max, setMax] = useState(String(Math.round(config.max_price_cents / 100)));

  const dirty =
    Math.round(config.min_price_cents / 100) !== Number(min) ||
    Math.round(config.base_price_cents / 100) !== Number(base) ||
    Math.round(config.max_price_cents / 100) !== Number(max);

  const rules = config.rules;
  const dowPeak = Math.max(...(rules.dowPct ?? [0]));
  const custom: { title: string; detail: string }[] = [
    {
      title: "Last-minute",
      detail:
        rules.leadtime?.some((s) => s.pct < 0)
          ? `Up to ${Math.abs(Math.min(...rules.leadtime.map((s) => s.pct)))}% off as check-in nears`
          : "None",
    },
    {
      title: "Orphan-gap prices",
      detail: rules.gap?.pct ? `${rules.gap.pct}% on gaps ≤ ${rules.gap.maxGapNights} nights` : "None",
    },
    {
      title: "Occupancy (pace)",
      detail: rules.pace?.enabled ? `±${rules.pace.maxPct}% vs target occupancy` : "Off",
    },
    {
      title: "Day-of-week",
      detail: dowPeak ? `Weekend +${dowPeak}%` : "None",
    },
    {
      title: "Minimum stay",
      detail: `${rules.minStay?.base ?? 2} nights${
        rules.minStay?.lastMinute ? `, ${rules.minStay.lastMinute.value} within ${rules.minStay.lastMinute.withinDays}d` : ""
      }`,
    },
  ];

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
          <span className="text-sm font-semibold">Applied Customizations</span>
          <div className="space-y-2.5">
            {custom.map((c) => (
              <div key={c.title}>
                <div className="text-xs font-medium">{c.title}</div>
                <div className="text-xs text-muted-foreground">{c.detail}</div>
              </div>
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
