"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Check } from "lucide-react";
import type { PricingConfig } from "./types";
import type { PricingRules } from "@/lib/pricing/engine";
import { CUSTOMIZATION_ITEMS } from "./customization-items";

// Full configuration surface: price anchors + every customization inline
// (each with its plain-English summary + editor), mirroring the modal's pages
// but on one scrollable page for power-editing.
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
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Price anchors</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-3">
          <Field label="Base ($/night)" value={base} onChange={setBase} />
          <Field label="Floor (min)" value={min} onChange={setMin} />
          <Field label="Ceiling (max)" value={max} onChange={setMax} />
        </CardContent>
      </Card>

      {CUSTOMIZATION_ITEMS.map((it) => (
        <Card key={it.key}>
          <CardHeader className="space-y-1.5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{it.title}</CardTitle>
              <Badge
                variant="secondary"
                className={it.applied(rules) ? "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400" : ""}
              >
                {it.applied(rules) ? (
                  <>
                    <Check className="mr-1 h-3 w-3" /> Applied
                  </>
                ) : (
                  "Off"
                )}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{it.explainer}</p>
            <p className="text-sm">{it.summary(rules)}</p>
          </CardHeader>
          <CardContent>
            <it.Editor rules={rules} onChange={setRules} />
          </CardContent>
        </Card>
      ))}

      <div className="sticky bottom-4 flex justify-end">
        <Button onClick={save} disabled={saving} size="lg" className="shadow-lg">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save & Refresh
        </Button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input type="number" value={value} onChange={(e) => onChange(e.target.value)} className="h-9" />
    </div>
  );
}
