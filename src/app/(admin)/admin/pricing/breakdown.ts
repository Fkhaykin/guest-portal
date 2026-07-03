// Reconstructs the PriceLabs-style price ladder (base → market factors →
// customizations → thresholds → final) from our engine's stored `factors`, so
// the calendar popover reads exactly like PriceLabs' "different prices
// explained" tooltip.

import type { PricingConfig, SnapshotRow, MarketPoint } from "./types";
import { fmtUsd } from "./types";

export interface LadderRow {
  label: string;
  pct: number | null; // signed percent, or null for headers/totals
  runningCents: number | null; // resulting price (market section) — the running total
  deltaCents?: number | null; // dollar contribution of a customization row
  kind: "section" | "factor" | "total";
}

export interface DemandLevel {
  key: "low" | "normal" | "good" | "high" | "unavailable" | "none";
  label: string;
  occPct: number | null;
}

/** Market-occupancy → PriceLabs-style demand band. */
export function demandLevel(row: SnapshotRow, market?: MarketPoint): DemandLevel {
  if (row.is_booked) return { key: "unavailable", label: "Unavailable", occPct: null };
  if (!market || market.occupancy == null || market.compsCounted === 0) {
    return { key: "none", label: "No market data", occPct: null };
  }
  const occ = Math.round(market.occupancy * 100);
  if (occ >= 80) return { key: "high", label: "High Demand", occPct: occ };
  if (occ >= 60) return { key: "good", label: "Good Demand", occPct: occ };
  if (occ >= 40) return { key: "normal", label: "Normal Demand", occPct: occ };
  return { key: "low", label: "Low Demand", occPct: occ };
}

export const DEMAND_COLORS: Record<DemandLevel["key"], string> = {
  low: "var(--demand-low)",
  normal: "var(--demand-normal)",
  good: "var(--demand-good)",
  high: "var(--demand-high)",
  unavailable: "var(--demand-unavailable)",
  none: "transparent",
};

/** The stacked price ladder for one night. Mirrors engine.ts math:
 *  seasonalBase = base×(1+season); structural = seasonalBase×(1+(dow+event));
 *  customized = structural×(1+dynamic+gap); then clamp/round/override. */
export function buildLadder(row: SnapshotRow, config: PricingConfig): LadderRow[] {
  const f = row.factors;
  if (!f) return [];
  const rows: LadderRow[] = [];

  const seasonalBase = f.base_cents * (1 + f.season_pct / 100);
  const afterDow = seasonalBase * (1 + f.dow_pct / 100);
  const structural = seasonalBase * (1 + (f.dow_pct + f.event_pct) / 100);

  rows.push({ label: "Base price", pct: null, runningCents: f.base_cents, kind: "total" });

  rows.push({ label: "Market factors", pct: null, runningCents: null, kind: "section" });
  if (f.season_pct) rows.push({ label: "Seasonality", pct: f.season_pct, runningCents: Math.round(seasonalBase), kind: "factor" });
  if (f.dow_pct) rows.push({ label: "Day of week", pct: f.dow_pct, runningCents: Math.round(afterDow), kind: "factor" });
  if (f.event_pct) rows.push({ label: "Event / holiday", pct: f.event_pct, runningCents: Math.round(structural), kind: "factor" });
  rows.push({ label: "Uncustomized price", pct: null, runningCents: Math.round(structural), kind: "total" });

  // Customizations: the surviving discount + any pace/velocity premium + gap.
  const velocity = f.velocity_pct ?? 0;
  const hasCust =
    f.discount_src !== null || f.pace_pct > 0 || f.gap_pct !== 0 || velocity !== 0 || f.smoothing_adj_pct !== 0;
  if (hasCust) {
    // Each customization's $ contribution is applied to the structural
    // (uncustomized) price — the engine stacks them additively there.
    const delta = (pct: number) => Math.round((structural * pct) / 100);
    rows.push({ label: "Price customizations", pct: null, runningCents: null, kind: "section" });
    if (f.discount_src === "leadtime") rows.push({ label: "Last-minute / lead-time", pct: f.leadtime_pct, runningCents: null, deltaCents: delta(f.leadtime_pct), kind: "factor" });
    if (f.discount_src === "pace") rows.push({ label: "Occupancy-based (pace)", pct: f.pace_pct, runningCents: null, deltaCents: delta(f.pace_pct), kind: "factor" });
    if (f.discount_src === "gap") rows.push({ label: "Orphan-gap factor", pct: f.gap_pct, runningCents: null, deltaCents: delta(f.gap_pct), kind: "factor" });
    if (f.pace_pct > 0) rows.push({ label: "Occupancy premium (pace)", pct: f.pace_pct, runningCents: null, deltaCents: delta(f.pace_pct), kind: "factor" });
    if (f.leadtime_pct > 0) rows.push({ label: "Far-out premium", pct: f.leadtime_pct, runningCents: null, deltaCents: delta(f.leadtime_pct), kind: "factor" });
    if (velocity !== 0)
      rows.push({
        label: f.pickup_7d != null ? `Booking velocity (${Math.round(f.pickup_7d * 100)}% pickup)` : "Booking velocity",
        pct: velocity,
        runningCents: null,
        deltaCents: delta(velocity),
        kind: "factor",
      });
    if (f.smoothing_adj_pct) rows.push({ label: "Smoothing", pct: f.smoothing_adj_pct, runningCents: null, deltaCents: delta(f.smoothing_adj_pct), kind: "factor" });
    rows.push({ label: "Customized price", pct: null, runningCents: f.pre_clamp_cents, kind: "total" });
  }

  rows.push({ label: "Thresholds", pct: null, runningCents: null, kind: "section" });
  rows.push({ label: "Min price", pct: null, runningCents: config.min_price_cents, kind: "factor" });
  rows.push({ label: "Max price", pct: null, runningCents: config.max_price_cents, kind: "factor" });
  if (f.override) rows.push({ label: "Date override", pct: null, runningCents: row.our_price_cents, kind: "factor" });
  rows.push({ label: "Final", pct: null, runningCents: row.our_price_cents, kind: "total" });

  return rows;
}

export function ladderValue(cents: number | null): string {
  return cents == null ? "" : fmtUsd(cents);
}
