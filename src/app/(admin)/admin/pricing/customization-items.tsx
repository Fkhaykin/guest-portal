"use client";

// Registry of every pricing customization: metadata (title, category,
// explainer), a plain-English summary of the currently-effective rule (the
// PriceLabs "Auto-applied" line), an is-active predicate, and the editor
// component for that one rule. The PriceLabs-style modal renders one page per
// item; the Configuration tab stacks them all.

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  VelocityTier,
} from "@/lib/pricing/engine";

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface CustomizationItem {
  key: string;
  title: string;
  category: "smart" | "stay" | "other";
  explainer: string;
  applied: (rules: PricingRules) => boolean;
  summary: (rules: PricingRules) => string;
  Editor: React.ComponentType<{ rules: PricingRules; onChange: (r: PricingRules) => void }>;
}

/* ---------- shared small controls ---------- */

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

function AddButton({ onClick, label = "Add" }: { onClick: () => void; label?: string }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick}>
      <Plus className="h-4 w-4" /> {label}
    </Button>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-xs text-muted-foreground">{children}</span>;
}

function setAt<T>(arr: T[], i: number, patch: Partial<T>): T[] {
  const next = [...arr];
  next[i] = { ...next[i], ...patch };
  return next;
}

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
const sortSteps = (s: LeadtimeStep[]) => [...s].sort((a, b) => a.maxDays - b.maxDays);
const sortTiers = (t: VelocityTier[]) => [...t].sort((a, b) => b.minPickup - a.minPickup);
const sortBuckets = (b: PaceBucket[]) => [...b].sort((a, b2) => a.days - b2.days);

/* ---------- per-rule editors ---------- */

function LastMinuteEditor({ rules, onChange }: { rules: PricingRules; onChange: (r: PricingRules) => void }) {
  const steps = rules.leadtime ?? [];
  const patch = (leadtime: LeadtimeStep[]) => onChange({ ...rules, leadtime });
  return (
    <div className="space-y-2">
      {steps.filter((s) => s.pct <= 0).length === 0 && <Muted>No last-minute discounts configured.</Muted>}
      {steps.map((s, i) =>
        s.pct > 0 ? null : (
          <Row key={i} onRemove={() => patch(steps.filter((_, j) => j !== i))}>
            <Muted>within</Muted>
            <NumInput value={s.maxDays} onChange={(v) => patch(sortSteps(setAt(steps, i, { maxDays: v })))} className="w-20" />
            <Muted>days of check-in →</Muted>
            <PctInput value={s.pct} onChange={(v) => patch(setAt(steps, i, { pct: v }))} />
          </Row>
        )
      )}
      <AddButton onClick={() => patch(sortSteps([...steps, { maxDays: 7, pct: -10 }]))} label="Add discount step" />
      <p className="text-xs text-muted-foreground">
        First matching step wins. Steeper cliffs close to check-in fill nights without training guests to wait.
      </p>
    </div>
  );
}

function FarOutEditor({ rules, onChange }: { rules: PricingRules; onChange: (r: PricingRules) => void }) {
  const steps = rules.leadtime ?? [];
  const patch = (leadtime: LeadtimeStep[]) => onChange({ ...rules, leadtime });
  return (
    <div className="space-y-2">
      {steps.filter((s) => s.pct > 0).length === 0 && <Muted>No far-out premium configured.</Muted>}
      {steps.map((s, i) =>
        s.pct <= 0 ? null : (
          <Row key={i} onRemove={() => patch(steps.filter((_, j) => j !== i))}>
            <Muted>dates up to</Muted>
            <NumInput value={s.maxDays} onChange={(v) => patch(sortSteps(setAt(steps, i, { maxDays: v })))} className="w-24" />
            <Muted>days out →</Muted>
            <PctInput value={s.pct} onChange={(v) => patch(setAt(steps, i, { pct: v }))} />
          </Row>
        )
      )}
      <AddButton onClick={() => patch(sortSteps([...steps, { maxDays: 9999, pct: 10 }]))} label="Add premium step" />
      <p className="text-xs text-muted-foreground">
        Far-future dates carry a premium so early bookers pay for certainty; the premium unwinds as the date approaches.
      </p>
    </div>
  );
}

function OrphanEditor({ rules, onChange }: { rules: PricingRules; onChange: (r: PricingRules) => void }) {
  const gap = rules.gap ?? { maxGapNights: 2, pct: -15, setMinStay: true };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Muted>Gaps up to</Muted>
        <NumInput value={gap.maxGapNights} onChange={(v) => onChange({ ...rules, gap: { ...gap, maxGapNights: Math.max(0, v) } })} className="w-16" />
        <Muted>nights →</Muted>
        <PctInput value={gap.pct} onChange={(v) => onChange({ ...rules, gap: { ...gap, pct: v } })} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Switch checked={gap.setMinStay} onCheckedChange={(v: boolean) => onChange({ ...rules, gap: { ...gap, setMinStay: v } })} />
        Drop min-stay to the gap length so the gap is bookable
      </label>
      <p className="text-xs text-muted-foreground">
        Use a positive % instead of a discount to deter 1-night party bookings.
      </p>
    </div>
  );
}

function PaceEditor({ rules, onChange }: { rules: PricingRules; onChange: (r: PricingRules) => void }) {
  const pace = rules.pace ?? { enabled: false, buckets: [], maxPct: 15 };
  const patch = (p: typeof pace) => onChange({ ...rules, pace: p });
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm">
        <Switch checked={pace.enabled} onCheckedChange={(v: boolean) => patch({ ...pace, enabled: v })} />
        Adjust prices based on my own occupancy vs target
      </label>
      {pace.enabled && (
        <>
          {pace.buckets.map((b, i) => (
            <Row key={i} onRemove={() => patch({ ...pace, buckets: pace.buckets.filter((_, j) => j !== i) })}>
              <Muted>next</Muted>
              <NumInput value={b.days} onChange={(v) => patch({ ...pace, buckets: sortBuckets(setAt(pace.buckets, i, { days: v })) })} className="w-20" />
              <Muted>days, target occupancy</Muted>
              <NumInput value={Math.round(b.targetOcc * 100)} onChange={(v) => patch({ ...pace, buckets: setAt(pace.buckets, i, { targetOcc: clamp01(v / 100) }) })} className="w-18" />
              <Muted>%</Muted>
            </Row>
          ))}
          <AddButton onClick={() => patch({ ...pace, buckets: [...pace.buckets, { days: 30, targetOcc: 0.5 }] })} label="Add window" />
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Max adjustment ±</Label>
            <NumInput value={pace.maxPct} onChange={(v) => patch({ ...pace, maxPct: Math.abs(v) })} className="w-18" />
            <Muted>%</Muted>
          </div>
          <p className="text-xs text-muted-foreground">
            Under target → discount; over target → premium. Half a percent of price per percent of occupancy gap.
          </p>
        </>
      )}
    </div>
  );
}

function WeatherEditor({ rules, onChange }: { rules: PricingRules; onChange: (r: PricingRules) => void }) {
  const weather = rules.weather ?? { enabled: true, maxPct: 8 };
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm">
        <Switch checked={weather.enabled} onCheckedChange={(v: boolean) => onChange({ ...rules, weather: { ...weather, enabled: v } })} />
        Adjust near-term prices for the weather forecast
      </label>
      {weather.enabled && (
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Max adjustment ±</Label>
          <NumInput value={weather.maxPct} onChange={(v) => onChange({ ...rules, weather: { ...weather, maxPct: Math.abs(v) } })} className="w-18" />
          <Muted>%</Muted>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Warm, dry days within the ~16-day forecast get a premium; cold, wet days a discount. Beyond the
        forecast window there is no adjustment. Something PriceLabs doesn&apos;t do.
      </p>
    </div>
  );
}

function VelocityEditor({ rules, onChange }: { rules: PricingRules; onChange: (r: PricingRules) => void }) {
  const velocity = rules.velocity ?? { enabled: true, tiers: [], maxPct: 15 };
  const patch = (v: typeof velocity) => onChange({ ...rules, velocity: v });
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm">
        <Switch checked={velocity.enabled} onCheckedChange={(v: boolean) => patch({ ...velocity, enabled: v })} />
        Price up dates the comp set is booking fast
      </label>
      {velocity.enabled && (
        <>
          {velocity.tiers.map((t, i) => (
            <Row key={i} onRemove={() => patch({ ...velocity, tiers: velocity.tiers.filter((_, j) => j !== i) })}>
              <Muted>pickup ≥</Muted>
              <NumInput value={Math.round(t.minPickup * 100)} onChange={(v) => patch({ ...velocity, tiers: sortTiers(setAt(velocity.tiers, i, { minPickup: clamp01(v / 100) })) })} className="w-18" />
              <Muted>% of comps booked in ~7 days →</Muted>
              <PctInput value={t.pct} onChange={(v) => patch({ ...velocity, tiers: setAt(velocity.tiers, i, { pct: Math.abs(v) }) })} />
            </Row>
          ))}
          <AddButton onClick={() => patch({ ...velocity, tiers: sortTiers([...velocity.tiers, { minPickup: 0.2, pct: 5 }]) })} label="Add tier" />
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Max premium +</Label>
            <NumInput value={velocity.maxPct} onChange={(v) => patch({ ...velocity, maxPct: Math.abs(v) })} className="w-18" />
            <Muted>%</Muted>
          </div>
        </>
      )}
    </div>
  );
}

function DowEditor({ rules, onChange }: { rules: PricingRules; onChange: (r: PricingRules) => void }) {
  const dow = rules.dowPct ?? [0, 0, 0, 0, 0, 0, 0];
  return (
    <div className="grid max-w-md grid-cols-7 gap-2">
      {DOW_LABELS.map((lbl, i) => (
        <div key={lbl} className="space-y-1">
          <Label className="text-xs text-muted-foreground">{lbl}</Label>
          <NumInput
            value={dow[i] ?? 0}
            onChange={(v) => {
              const next = [...dow];
              next[i] = Number.isFinite(v) ? v : 0;
              onChange({ ...rules, dowPct: next });
            }}
            className="w-full"
          />
        </div>
      ))}
    </div>
  );
}

function SeasonsEditor({ rules, onChange }: { rules: PricingRules; onChange: (r: PricingRules) => void }) {
  const seasons = rules.seasons ?? [];
  const patch = (s: SeasonRule[]) => onChange({ ...rules, seasons: s });
  return (
    <div className="space-y-2">
      {seasons.length === 0 && <Muted>No seasons — base price applies year-round.</Muted>}
      {seasons.map((s, i) => (
        <Row key={i} onRemove={() => patch(seasons.filter((_, j) => j !== i))}>
          <Input placeholder="Label" value={s.label ?? ""} onChange={(e) => patch(setAt(seasons, i, { label: e.target.value }))} className="h-8 w-28" />
          <Input placeholder="07-01" value={s.from} onChange={(e) => patch(setAt(seasons, i, { from: e.target.value }))} className="h-8 w-22" />
          <Muted>to</Muted>
          <Input placeholder="08-31" value={s.to} onChange={(e) => patch(setAt(seasons, i, { to: e.target.value }))} className="h-8 w-22" />
          <PctInput value={s.pct} onChange={(v) => patch(setAt(seasons, i, { pct: v }))} />
        </Row>
      ))}
      <AddButton onClick={() => patch([...seasons, { from: "", to: "", pct: 0, label: "" }])} label="Add season" />
      <p className="text-xs text-muted-foreground">Recurring MM-DD ranges (may wrap the year end); percent vs base price.</p>
    </div>
  );
}

function EventsEditor({ rules, onChange }: { rules: PricingRules; onChange: (r: PricingRules) => void }) {
  const events = rules.events ?? [];
  const patch = (e: EventRule[]) => onChange({ ...rules, events: e });
  return (
    <div className="space-y-2">
      {events.length === 0 && <Muted>No events yet.</Muted>}
      {events.map((ev, i) => (
        <Row key={i} onRemove={() => patch(events.filter((_, j) => j !== i))}>
          <Input placeholder="Label (e.g. July 4th)" value={ev.label ?? ""} onChange={(e) => patch(setAt(events, i, { label: e.target.value }))} className="h-8 w-40" />
          <Input type="date" value={ev.from} onChange={(e) => patch(setAt(events, i, { from: e.target.value }))} className="h-8 w-36" />
          <Input type="date" value={ev.to} onChange={(e) => patch(setAt(events, i, { to: e.target.value }))} className="h-8 w-36" />
          <PctInput value={ev.pct} onChange={(v) => patch(setAt(events, i, { pct: v }))} />
        </Row>
      ))}
      <AddButton onClick={() => patch([...events, { from: "", to: "", pct: 0, label: "" }])} label="Add event" />
    </div>
  );
}

function MinStayEditor({ rules, onChange }: { rules: PricingRules; onChange: (r: PricingRules) => void }) {
  const minStay = rules.minStay ?? { base: 2, seasons: [], lastMinute: null };
  const patch = (m: typeof minStay) => onChange({ ...rules, minStay: m });
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground">Default</Label>
        <NumInput value={minStay.base} onChange={(v) => patch({ ...minStay, base: Math.max(1, v) })} className="w-16" />
        <Muted>nights</Muted>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Switch
          checked={!!minStay.lastMinute}
          onCheckedChange={(v: boolean) => patch({ ...minStay, lastMinute: v ? { withinDays: 7, value: 1 } : null })}
        />
        Relax min-stay close to check-in
      </label>
      {minStay.lastMinute && (
        <div className="flex items-center gap-2 pl-8">
          <Muted>within</Muted>
          <NumInput value={minStay.lastMinute.withinDays} onChange={(v) => patch({ ...minStay, lastMinute: { ...minStay.lastMinute!, withinDays: Math.max(0, v) } })} className="w-16" />
          <Muted>days →</Muted>
          <NumInput value={minStay.lastMinute.value} onChange={(v) => patch({ ...minStay, lastMinute: { ...minStay.lastMinute!, value: Math.max(1, v) } })} className="w-16" />
          <Muted>nights</Muted>
        </div>
      )}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Seasonal min-stays</Label>
        {(minStay.seasons ?? []).map((s, i) => (
          <Row key={i} onRemove={() => patch({ ...minStay, seasons: minStay.seasons.filter((_, j) => j !== i) })}>
            <Input placeholder="06-15" value={s.from} onChange={(e) => patch({ ...minStay, seasons: setAt<MinStaySeason>(minStay.seasons, i, { from: e.target.value }) })} className="h-8 w-22" />
            <Muted>to</Muted>
            <Input placeholder="08-31" value={s.to} onChange={(e) => patch({ ...minStay, seasons: setAt<MinStaySeason>(minStay.seasons, i, { to: e.target.value }) })} className="h-8 w-22" />
            <Muted>→</Muted>
            <NumInput value={s.value} onChange={(v) => patch({ ...minStay, seasons: setAt<MinStaySeason>(minStay.seasons, i, { value: Math.max(1, v) }) })} className="w-16" />
            <Muted>nights</Muted>
          </Row>
        ))}
        <AddButton onClick={() => patch({ ...minStay, seasons: [...(minStay.seasons ?? []), { from: "", to: "", value: 2 }] })} label="Add seasonal rule" />
      </div>
      <p className="text-xs text-muted-foreground">
        Orphan gaps additionally drop min-stay to the gap length when enabled in Orphan Day Prices.
      </p>
    </div>
  );
}

function OverridesEditor({ rules, onChange }: { rules: PricingRules; onChange: (r: PricingRules) => void }) {
  const overrides = rules.overrides ?? [];
  const patch = (o: DateOverride[]) => onChange({ ...rules, overrides: o });
  return (
    <div className="space-y-2">
      {overrides.length === 0 && <Muted>No overrides.</Muted>}
      {overrides.map((o, i) => (
        <Row key={i} onRemove={() => patch(overrides.filter((_, j) => j !== i))}>
          <Input type="date" value={o.date} onChange={(e) => patch(setAt(overrides, i, { date: e.target.value }))} className="h-8 w-36" />
          <Muted>$</Muted>
          <NumInput
            value={o.price_cents != null ? Math.round(o.price_cents / 100) : ("" as unknown as number)}
            onChange={(v) => patch(setAt(overrides, i, { price_cents: Number.isFinite(v) && v > 0 ? Math.round(v * 100) : undefined }))}
            className="w-22"
          />
          <Muted>min-stay</Muted>
          <NumInput
            value={o.min_stay ?? ("" as unknown as number)}
            onChange={(v) => patch(setAt(overrides, i, { min_stay: Number.isFinite(v) && v > 0 ? Math.round(v) : undefined }))}
            className="w-16"
          />
          <Input placeholder="Label" value={o.label ?? ""} onChange={(e) => patch(setAt(overrides, i, { label: e.target.value }))} className="h-8 flex-1" />
        </Row>
      ))}
      <AddButton onClick={() => patch([...overrides, { date: "" }])} label="Add override" />
      <p className="text-xs text-muted-foreground">Overrides pin a price/min-stay to a date and pierce everything, including min/max.</p>
    </div>
  );
}

function SmoothingEditor({ rules, onChange }: { rules: PricingRules; onChange: (r: PricingRules) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Muted>Max change between adjacent nights ±</Muted>
      <NumInput value={rules.smoothingPct ?? 15} onChange={(v) => onChange({ ...rules, smoothingPct: Math.max(0, Number.isFinite(v) ? v : 0) })} className="w-18" />
      <Muted>%</Muted>
    </div>
  );
}

/* ---------- summaries ---------- */

const pctList = (steps: LeadtimeStep[], neg: boolean) =>
  steps.filter((s) => (neg ? s.pct < 0 : s.pct > 0)).sort((a, b) => a.maxDays - b.maxDays);

export const CUSTOMIZATION_ITEMS: CustomizationItem[] = [
  {
    key: "last-minute",
    title: "Last Minute Prices",
    category: "smart",
    explainer: "Discount unsold nights as check-in approaches to encourage nearby bookings.",
    applied: (r) => pctList(r.leadtime ?? [], true).length > 0,
    summary: (r) => {
      const steps = pctList(r.leadtime ?? [], true);
      if (!steps.length) return "No last-minute discounts.";
      const deepest = steps.reduce((a, b) => (b.pct < a.pct ? b : a));
      const horizon = Math.max(...steps.map((s) => s.maxDays));
      return `Discount reaches ${Math.abs(deepest.pct)}% for last-minute dates, phasing out by ${horizon} days before check-in.`;
    },
    Editor: LastMinuteEditor,
  },
  {
    key: "far-out",
    title: "Far Out Prices",
    category: "smart",
    explainer: "Add a premium to far-future dates; early bookers pay for certainty.",
    applied: (r) => pctList(r.leadtime ?? [], false).length > 0,
    summary: (r) => {
      const steps = pctList(r.leadtime ?? [], false);
      if (!steps.length) return "No far-out premium.";
      const top = steps.reduce((a, b) => (b.pct > a.pct ? b : a));
      return `+${top.pct}% premium on far-future dates.`;
    },
    Editor: FarOutEditor,
  },
  {
    key: "orphan",
    title: "Orphan Day Prices",
    category: "smart",
    explainer: "Adjust short gaps stranded between bookings and make them bookable.",
    applied: (r) => (r.gap?.pct ?? 0) !== 0,
    summary: (r) =>
      r.gap?.pct
        ? `${r.gap.pct > 0 ? "+" : ""}${r.gap.pct}% on gaps of ≤ ${r.gap.maxGapNights} nights${r.gap.setMinStay ? "; min-stay drops to the gap length" : ""}.`
        : "No orphan-gap adjustment.",
    Editor: OrphanEditor,
  },
  {
    key: "pace",
    title: "Occupancy Based Adjustments",
    category: "smart",
    explainer: "Compare your booked share against a target per window; under-booked discounts, over-booked premiums.",
    applied: (r) => !!r.pace?.enabled && (r.pace?.buckets?.length ?? 0) > 0,
    summary: (r) =>
      r.pace?.enabled && r.pace.buckets.length
        ? `±up to ${r.pace.maxPct}% vs targets: ${r.pace.buckets.map((b) => `${Math.round(b.targetOcc * 100)}% @ ${b.days}d`).join(", ")}.`
        : "Off.",
    Editor: PaceEditor,
  },
  {
    key: "velocity",
    title: "Booking Velocity",
    category: "smart",
    explainer: "Watches how fast your comp set books each date (7-day pickup) and prices hot dates up automatically. PriceLabs has nothing configurable like this.",
    applied: (r) => !!r.velocity?.enabled && (r.velocity?.tiers?.length ?? 0) > 0,
    summary: (r) =>
      r.velocity?.enabled && r.velocity.tiers.length
        ? `${[...r.velocity.tiers].sort((a, b) => a.minPickup - b.minPickup).map((t) => `+${t.pct}% at ${Math.round(t.minPickup * 100)}% pickup`).join(", ")} (cap +${r.velocity.maxPct}%).`
        : "Off.",
    Editor: VelocityEditor,
  },
  {
    key: "weather",
    title: "Weather",
    category: "smart",
    explainer: "Prices near-term dates on the actual forecast — warm/dry up, cold/wet down. PriceLabs doesn't do this at all.",
    applied: (r) => !!r.weather?.enabled,
    summary: (r) =>
      r.weather?.enabled ? `±up to ${r.weather.maxPct}% on the next ~16 days by forecast.` : "Off.",
    Editor: WeatherEditor,
  },
  {
    key: "dow",
    title: "Day of Week Pricing Adjustments",
    category: "smart",
    explainer: "Structural premium or discount per weekday.",
    applied: (r) => (r.dowPct ?? []).some((p) => p !== 0),
    summary: (r) => {
      const named = (r.dowPct ?? []).map((p, i) => ({ p, d: DOW_LABELS[i] })).filter((x) => x.p !== 0);
      return named.length ? named.map((x) => `${x.d} ${x.p > 0 ? "+" : ""}${x.p}%`).join(", ") : "No weekday adjustments.";
    },
    Editor: DowEditor,
  },
  {
    key: "seasons",
    title: "Seasonal Profiles",
    category: "smart",
    explainer: "Recurring seasonal tiers that shape the base price through the year.",
    applied: (r) => (r.seasons ?? []).length > 0,
    summary: (r) => {
      const s = r.seasons ?? [];
      if (!s.length) return "Base price year-round.";
      const min = Math.min(...s.map((x) => x.pct));
      const max = Math.max(...s.map((x) => x.pct));
      return `${s.length} seasonal tiers, ${min >= 0 ? "+" : ""}${min}% to +${max}% vs base.`;
    },
    Editor: SeasonsEditor,
  },
  {
    key: "events",
    title: "Events & Holidays",
    category: "smart",
    explainer: "Specific date windows (holidays, local events) layered on top of seasons.",
    applied: (r) => (r.events ?? []).length > 0,
    summary: (r) => {
      const e = r.events ?? [];
      return e.length
        ? `${e.length} event window${e.length > 1 ? "s" : ""}: ${e.slice(0, 3).map((x) => `${x.label || x.from} ${x.pct > 0 ? "+" : ""}${x.pct}%`).join(", ")}${e.length > 3 ? "…" : ""}`
        : "No events.";
    },
    Editor: EventsEditor,
  },
  {
    key: "min-stay",
    title: "Minimum Stay Settings",
    category: "stay",
    explainer: "Default minimum nights, seasonal rules, and the last-minute relaxation.",
    applied: () => true,
    summary: (r) => {
      const m = r.minStay ?? { base: 2, seasons: [], lastMinute: null };
      const parts = [`${m.base} nights default`];
      for (const s of m.seasons ?? []) parts.push(`${s.value} from ${s.from} to ${s.to}`);
      if (m.lastMinute) parts.push(`${m.lastMinute.value} within ${m.lastMinute.withinDays}d of check-in`);
      return parts.join("; ") + ".";
    },
    Editor: MinStayEditor,
  },
  {
    key: "overrides",
    title: "Date Overrides",
    category: "other",
    explainer: "Pin a fixed price and/or min-stay to specific dates. Beats every other rule.",
    applied: (r) => (r.overrides ?? []).length > 0,
    summary: (r) => {
      const o = r.overrides ?? [];
      return o.length ? `${o.length} date${o.length > 1 ? "s" : ""} pinned.` : "No overrides.";
    },
    Editor: OverridesEditor,
  },
  {
    key: "smoothing",
    title: "Price Smoothing",
    category: "other",
    explainer: "Caps night-to-night price changes so repeat guests don't see whiplash. Weekend and event jumps are preserved.",
    applied: (r) => (r.smoothingPct ?? 0) > 0,
    summary: (r) => ((r.smoothingPct ?? 0) > 0 ? `Night-to-night changes capped at ±${r.smoothingPct}%.` : "Off."),
    Editor: SmoothingEditor,
  },
];

export function appliedCount(rules: PricingRules): number {
  return CUSTOMIZATION_ITEMS.filter((it) => it.applied(rules)).length;
}
