"use client";

// Full editor for every pricing customization the engine understands —
// lead-time curve, occupancy pace, orphan gaps, min-stays, day-of-week,
// seasons, events, smoothing, and date overrides. Controlled: parent owns the
// rules object. Used by the Configuration tab and the Calendar rail's
// "Applied Customizations → Edit" dialog.

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2 } from "lucide-react";
import type {
  PricingRules,
  SeasonRule,
  EventRule,
  LeadtimeStep,
  PaceBucket,
  MinStaySeason,
  DateOverride,
} from "@/lib/pricing/engine";

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function RulesEditor({
  rules,
  onChange,
}: {
  rules: PricingRules;
  onChange: (rules: PricingRules) => void;
}) {
  const patch = (p: Partial<PricingRules>) => onChange({ ...rules, ...p });
  const dow = rules.dowPct ?? [0, 0, 0, 0, 0, 0, 0];
  const leadtime = rules.leadtime ?? [];
  const pace = rules.pace ?? { enabled: false, buckets: [], maxPct: 15 };
  const gap = rules.gap ?? { maxGapNights: 2, pct: -15, setMinStay: true };
  const minStay = rules.minStay ?? { base: 2, seasons: [], lastMinute: null };
  const overrides = rules.overrides ?? [];

  return (
    <div className="space-y-4">
      <Section title="Day-of-week (%)" hint="Structural premium/discount per weekday.">
        <div className="grid grid-cols-7 gap-2">
          {DOW_LABELS.map((lbl, i) => (
            <div key={lbl} className="space-y-1">
              <Label className="text-xs text-muted-foreground">{lbl}</Label>
              <NumInput
                value={dow[i] ?? 0}
                onChange={(v) => {
                  const next = [...dow];
                  next[i] = v;
                  patch({ dowPct: next });
                }}
              />
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Seasons (recurring, MM-DD)"
        hint="Percent vs base price; ranges may wrap the year end (12-15 → 03-15)."
        onAdd={() => patch({ seasons: [...(rules.seasons ?? []), { from: "", to: "", pct: 0, label: "" }] })}
      >
        {(rules.seasons ?? []).length === 0 && <Empty>No seasons — base price applies year-round.</Empty>}
        {(rules.seasons ?? []).map((s, i) => (
          <Row key={i} onRemove={() => patch({ seasons: rules.seasons.filter((_, j) => j !== i) })}>
            <Input placeholder="Label" value={s.label ?? ""} onChange={(e) => patch({ seasons: setAt(rules.seasons, i, { label: e.target.value }) })} className="h-8 flex-1" />
            <Input placeholder="07-01" value={s.from} onChange={(e) => patch({ seasons: setAt(rules.seasons, i, { from: e.target.value }) })} className="h-8 w-22" />
            <Input placeholder="08-31" value={s.to} onChange={(e) => patch({ seasons: setAt(rules.seasons, i, { to: e.target.value }) })} className="h-8 w-22" />
            <PctInput value={s.pct} onChange={(v) => patch({ seasons: setAt<SeasonRule>(rules.seasons, i, { pct: v }) })} />
          </Row>
        ))}
      </Section>

      <Section
        title="Events & holidays"
        hint="Specific date ranges layered on top of seasons."
        onAdd={() => patch({ events: [...(rules.events ?? []), { from: "", to: "", pct: 0, label: "" }] })}
      >
        {(rules.events ?? []).length === 0 && <Empty>No events yet.</Empty>}
        {(rules.events ?? []).map((ev, i) => (
          <Row key={i} onRemove={() => patch({ events: rules.events.filter((_, j) => j !== i) })}>
            <Input placeholder="Label (e.g. July 4th)" value={ev.label ?? ""} onChange={(e) => patch({ events: setAt(rules.events, i, { label: e.target.value }) })} className="h-8 flex-1" />
            <Input type="date" value={ev.from} onChange={(e) => patch({ events: setAt(rules.events, i, { from: e.target.value }) })} className="h-8 w-36" />
            <Input type="date" value={ev.to} onChange={(e) => patch({ events: setAt(rules.events, i, { to: e.target.value }) })} className="h-8 w-36" />
            <PctInput value={ev.pct} onChange={(v) => patch({ events: setAt<EventRule>(rules.events, i, { pct: v }) })} />
          </Row>
        ))}
      </Section>

      <Section
        title="Last-minute & far-out (lead-time curve)"
        hint="First matching step wins: negative % = discount near check-in, positive % = far-out premium. Keep a large final step (e.g. 9999 days) as the default."
        onAdd={() => patch({ leadtime: [...leadtime, { maxDays: 0, pct: 0 }] })}
      >
        {leadtime.map((s, i) => (
          <Row key={i} onRemove={() => patch({ leadtime: leadtime.filter((_, j) => j !== i) })}>
            <span className="text-xs text-muted-foreground">within</span>
            <NumInput value={s.maxDays} onChange={(v) => patch({ leadtime: sortSteps(setAt<LeadtimeStep>(leadtime, i, { maxDays: v })) })} className="w-20" />
            <span className="text-xs text-muted-foreground">days of check-in →</span>
            <PctInput value={s.pct} onChange={(v) => patch({ leadtime: setAt<LeadtimeStep>(leadtime, i, { pct: v }) })} />
          </Row>
        ))}
      </Section>

      <Section
        title="Occupancy-based adjustment (pace)"
        hint="Compares your booked % against a target per window; under-booked discounts, over-booked premiums (half a percent of price per percent of occupancy gap)."
        action={
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Enabled
            <Switch checked={pace.enabled} onCheckedChange={(v: boolean) => patch({ pace: { ...pace, enabled: v } })} />
          </label>
        }
        onAdd={pace.enabled ? () => patch({ pace: { ...pace, buckets: [...pace.buckets, { days: 30, targetOcc: 0.5 }] } }) : undefined}
      >
        {pace.enabled && (
          <>
            {pace.buckets.map((b, i) => (
              <Row key={i} onRemove={() => patch({ pace: { ...pace, buckets: pace.buckets.filter((_, j) => j !== i) } })}>
                <span className="text-xs text-muted-foreground">next</span>
                <NumInput value={b.days} onChange={(v) => patch({ pace: { ...pace, buckets: sortBuckets(setAt<PaceBucket>(pace.buckets, i, { days: v })) } })} className="w-20" />
                <span className="text-xs text-muted-foreground">days, target occupancy</span>
                <NumInput value={Math.round(b.targetOcc * 100)} onChange={(v) => patch({ pace: { ...pace, buckets: setAt<PaceBucket>(pace.buckets, i, { targetOcc: clamp01(v / 100) }) } })} className="w-18" />
                <span className="text-xs text-muted-foreground">%</span>
              </Row>
            ))}
            <div className="flex items-center gap-2 pt-1">
              <Label className="text-xs text-muted-foreground">Max adjustment ±</Label>
              <NumInput value={pace.maxPct} onChange={(v) => patch({ pace: { ...pace, maxPct: Math.abs(v) } })} className="w-18" />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
          </>
        )}
      </Section>

      <Section title="Orphan gaps" hint="Short unbookable gaps between reservations.">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Gaps up to</span>
          <NumInput value={gap.maxGapNights} onChange={(v) => patch({ gap: { ...gap, maxGapNights: Math.max(0, v) } })} className="w-16" />
          <span className="text-xs text-muted-foreground">nights →</span>
          <PctInput value={gap.pct} onChange={(v) => patch({ gap: { ...gap, pct: v } })} />
          <label className="ml-2 flex items-center gap-2 text-xs text-muted-foreground">
            Drop min-stay to gap length
            <Switch checked={gap.setMinStay} onCheckedChange={(v: boolean) => patch({ gap: { ...gap, setMinStay: v } })} />
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          Tip: use a positive % to deter 1-night party bookings instead of discounting.
        </p>
      </Section>

      <Section
        title="Minimum stay"
        onAdd={() => patch({ minStay: { ...minStay, seasons: [...(minStay.seasons ?? []), { from: "", to: "", value: 2 }] } })}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Label className="text-xs text-muted-foreground">Default</Label>
          <NumInput value={minStay.base} onChange={(v) => patch({ minStay: { ...minStay, base: Math.max(1, v) } })} className="w-16" />
          <span className="text-xs text-muted-foreground">nights</span>
          <label className="ml-3 flex items-center gap-2 text-xs text-muted-foreground">
            Last-minute drop
            <Switch
              checked={!!minStay.lastMinute}
              onCheckedChange={(v: boolean) =>
                patch({ minStay: { ...minStay, lastMinute: v ? { withinDays: 7, value: 1 } : null } })
              }
            />
          </label>
          {minStay.lastMinute && (
            <>
              <span className="text-xs text-muted-foreground">within</span>
              <NumInput value={minStay.lastMinute.withinDays} onChange={(v) => patch({ minStay: { ...minStay, lastMinute: { ...minStay.lastMinute!, withinDays: Math.max(0, v) } } })} className="w-16" />
              <span className="text-xs text-muted-foreground">days →</span>
              <NumInput value={minStay.lastMinute.value} onChange={(v) => patch({ minStay: { ...minStay, lastMinute: { ...minStay.lastMinute!, value: Math.max(1, v) } } })} className="w-16" />
              <span className="text-xs text-muted-foreground">nights</span>
            </>
          )}
        </div>
        {(minStay.seasons ?? []).map((s, i) => (
          <Row key={i} onRemove={() => patch({ minStay: { ...minStay, seasons: minStay.seasons.filter((_, j) => j !== i) } })}>
            <span className="text-xs text-muted-foreground">from</span>
            <Input placeholder="06-15" value={s.from} onChange={(e) => patch({ minStay: { ...minStay, seasons: setAt<MinStaySeason>(minStay.seasons, i, { from: e.target.value }) } })} className="h-8 w-22" />
            <span className="text-xs text-muted-foreground">to</span>
            <Input placeholder="08-31" value={s.to} onChange={(e) => patch({ minStay: { ...minStay, seasons: setAt<MinStaySeason>(minStay.seasons, i, { to: e.target.value }) } })} className="h-8 w-22" />
            <span className="text-xs text-muted-foreground">→</span>
            <NumInput value={s.value} onChange={(v) => patch({ minStay: { ...minStay, seasons: setAt<MinStaySeason>(minStay.seasons, i, { value: Math.max(1, v) }) } })} className="w-16" />
            <span className="text-xs text-muted-foreground">nights</span>
          </Row>
        ))}
      </Section>

      <Section
        title="Date overrides"
        hint="Pin a price and/or min-stay to specific dates — overrides everything, including min/max."
        onAdd={() => patch({ overrides: [...overrides, { date: "" }] })}
      >
        {overrides.length === 0 && <Empty>No overrides.</Empty>}
        {overrides.map((o, i) => (
          <Row key={i} onRemove={() => patch({ overrides: overrides.filter((_, j) => j !== i) })}>
            <Input type="date" value={o.date} onChange={(e) => patch({ overrides: setAt<DateOverride>(overrides, i, { date: e.target.value }) })} className="h-8 w-36" />
            <span className="text-xs text-muted-foreground">$</span>
            <NumInput
              value={o.price_cents != null ? Math.round(o.price_cents / 100) : ("" as unknown as number)}
              onChange={(v) => patch({ overrides: setAt<DateOverride>(overrides, i, { price_cents: Number.isFinite(v) && v > 0 ? Math.round(v * 100) : undefined }) })}
              className="w-22"
            />
            <span className="text-xs text-muted-foreground">min-stay</span>
            <NumInput
              value={o.min_stay ?? ("" as unknown as number)}
              onChange={(v) => patch({ overrides: setAt<DateOverride>(overrides, i, { min_stay: Number.isFinite(v) && v > 0 ? Math.round(v) : undefined }) })}
              className="w-16"
            />
            <Input placeholder="Label" value={o.label ?? ""} onChange={(e) => patch({ overrides: setAt<DateOverride>(overrides, i, { label: e.target.value }) })} className="h-8 flex-1" />
          </Row>
        ))}
      </Section>

      <Section title="Smoothing" hint="Caps the night-to-night change from lead-time/pace so prices don't whiplash for repeat guests. Weekend and event jumps are preserved.">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Max change between adjacent nights ±</span>
          <NumInput value={rules.smoothingPct ?? 15} onChange={(v) => patch({ smoothingPct: Math.max(0, v) })} className="w-18" />
          <span className="text-xs text-muted-foreground">%</span>
        </div>
      </Section>
    </div>
  );
}

/* ---------- small building blocks ---------- */

function Section({
  title,
  hint,
  action,
  onAdd,
  children,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  onAdd?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className="flex items-center gap-2">
          {action}
          {onAdd && (
            <Button variant="ghost" size="sm" onClick={onAdd}>
              <Plus className="h-4 w-4" /> Add
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">{children}</CardContent>
    </Card>
  );
}

function Row({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {children}
      <Button variant="ghost" size="icon" onClick={onRemove}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function NumInput({
  value,
  onChange,
  className,
}: {
  value: number | "";
  onChange: (v: number) => void;
  className?: string;
}) {
  return (
    <Input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value === "" ? NaN : parseFloat(e.target.value))}
      className={`h-8 px-2 text-sm ${className ?? "w-20"}`}
    />
  );
}

function PctInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      <NumInput value={value} onChange={(v) => onChange(Number.isFinite(v) ? v : 0)} className="w-20" />
      <span className="text-sm text-muted-foreground">%</span>
    </div>
  );
}

function setAt<T>(arr: T[], i: number, patch: Partial<T>): T[] {
  const next = [...arr];
  next[i] = { ...next[i], ...patch };
  return next;
}

function sortSteps(steps: LeadtimeStep[]): LeadtimeStep[] {
  return [...steps].sort((a, b) => a.maxDays - b.maxDays);
}

function clamp01(v: number): number {
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
}

function sortBuckets(buckets: PaceBucket[]): PaceBucket[] {
  return [...buckets].sort((a, b) => a.days - b.days);
}
