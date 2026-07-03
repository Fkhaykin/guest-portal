"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Plus, Trash2 } from "lucide-react";
import type { PricingConfig } from "./types";
import type { EventRule, SeasonRule } from "@/lib/pricing/engine";

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function ConfigEditor({
  config,
  onSave,
  saving,
}: {
  config: PricingConfig;
  onSave: (patch: Partial<PricingConfig>) => void;
  saving: boolean;
}) {
  const [base, setBase] = useState(String(config.base_price_cents / 100));
  const [min, setMin] = useState(String(config.min_price_cents / 100));
  const [max, setMax] = useState(String(config.max_price_cents / 100));
  const [dow, setDow] = useState<number[]>(config.rules.dowPct ?? [0, 0, 0, 0, 0, 15, 15]);
  const [seasons, setSeasons] = useState<SeasonRule[]>(config.rules.seasons ?? []);
  const [events, setEvents] = useState<EventRule[]>(config.rules.events ?? []);
  const [smoothing, setSmoothing] = useState(String(config.rules.smoothingPct ?? 15));
  const [gapPct, setGapPct] = useState(String(config.rules.gap?.pct ?? -15));

  function save() {
    onSave({
      base_price_cents: Math.round(parseFloat(base) * 100),
      min_price_cents: Math.round(parseFloat(min) * 100),
      max_price_cents: Math.round(parseFloat(max) * 100),
      rules: {
        ...config.rules,
        dowPct: dow,
        seasons: seasons.filter((s) => s.from && s.to),
        events: events.filter((e) => e.from && e.to),
        smoothingPct: parseFloat(smoothing) || 0,
        gap: { ...config.rules.gap, pct: parseFloat(gapPct) || 0 },
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Day-of-week (%)</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-7 gap-2">
          {DOW_LABELS.map((lbl, i) => (
            <div key={lbl} className="space-y-1">
              <Label className="text-xs text-muted-foreground">{lbl}</Label>
              <Input
                type="number"
                value={dow[i] ?? 0}
                onChange={(e) => {
                  const next = [...dow];
                  next[i] = parseFloat(e.target.value) || 0;
                  setDow(next);
                }}
                className="h-8 px-2 text-sm"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Seasons (recurring, MM-DD)</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSeasons([...seasons, { from: "", to: "", pct: 0, label: "" }])}
          >
            <Plus className="h-4 w-4" /> Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {seasons.length === 0 && <p className="text-sm text-muted-foreground">No seasons yet.</p>}
          {seasons.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                placeholder="Label"
                value={s.label ?? ""}
                onChange={(e) => updateAt(seasons, setSeasons, i, { label: e.target.value })}
                className="h-8 flex-1"
              />
              <Input
                placeholder="07-01"
                value={s.from}
                onChange={(e) => updateAt(seasons, setSeasons, i, { from: e.target.value })}
                className="h-8 w-24"
              />
              <Input
                placeholder="08-31"
                value={s.to}
                onChange={(e) => updateAt(seasons, setSeasons, i, { to: e.target.value })}
                className="h-8 w-24"
              />
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={s.pct}
                  onChange={(e) => updateAt(seasons, setSeasons, i, { pct: parseFloat(e.target.value) || 0 })}
                  className="h-8 w-20"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSeasons(seasons.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Events (specific dates, YYYY-MM-DD)</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEvents([...events, { from: "", to: "", pct: 0, label: "" }])}
          >
            <Plus className="h-4 w-4" /> Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {events.length === 0 && <p className="text-sm text-muted-foreground">No events yet.</p>}
          {events.map((ev, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                placeholder="Label (e.g. NASCAR weekend)"
                value={ev.label ?? ""}
                onChange={(e) => updateAt(events, setEvents, i, { label: e.target.value })}
                className="h-8 flex-1"
              />
              <Input
                type="date"
                value={ev.from}
                onChange={(e) => updateAt(events, setEvents, i, { from: e.target.value })}
                className="h-8 w-40"
              />
              <Input
                type="date"
                value={ev.to}
                onChange={(e) => updateAt(events, setEvents, i, { to: e.target.value })}
                className="h-8 w-40"
              />
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={ev.pct}
                  onChange={(e) => updateAt(events, setEvents, i, { pct: parseFloat(e.target.value) || 0 })}
                  className="h-8 w-20"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setEvents(events.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Guardrails</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <Field label="Smoothing cap (% between nights)" value={smoothing} onChange={setSmoothing} />
          <Field label="Orphan-gap adjustment (%)" value={gapPct} onChange={setGapPct} />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save configuration
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

function updateAt<T>(arr: T[], set: (v: T[]) => void, i: number, patch: Partial<T>) {
  const next = [...arr];
  next[i] = { ...next[i], ...patch };
  set(next);
}
