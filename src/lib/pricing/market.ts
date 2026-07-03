// Market aggregation from comp snapshots: per-stay-date occupancy and price
// percentile bands (the inputs to the Pricing Lab's Neighborhood Data charts
// and per-day demand shading), plus our own listing's occupancy metrics.

import { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

export interface MarketDatePoint {
  stay_date: string;
  occupancy: number | null; // 0..1 fraction of comps unavailable that night
  compsCounted: number;
  p25: number | null; // price percentiles in cents (from probed comp prices)
  p50: number | null;
  p75: number | null;
  p90: number | null;
  pricesCounted: number;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo));
}

/** Latest comp snapshot per (comp, stay_date), aggregated across a nickname's
 *  non-self comps into per-date market occupancy + price bands. */
export async function loadMarketByDate(
  admin: Admin,
  nickname: string,
  fromDate: string,
  toDate: string
): Promise<Map<string, MarketDatePoint>> {
  const { data: comps } = await admin
    .from("comp_listing")
    .select("id")
    .ilike("nickname", nickname)
    .eq("is_self", false)
    .eq("is_active", true);
  const compIds = (comps ?? []).map((c) => c.id);
  const byDate = new Map<string, MarketDatePoint>();
  if (compIds.length === 0) return byDate;

  // Newest snapshot per comp — comps scrape on different days.
  const { data: latestPerComp } = await admin
    .from("comp_snapshot")
    .select("comp_id, snapshot_date")
    .in("comp_id", compIds)
    .order("snapshot_date", { ascending: false });
  const newest = new Map<string, string>();
  for (const r of latestPerComp ?? []) {
    if (!newest.has(r.comp_id)) newest.set(r.comp_id, r.snapshot_date as string);
  }

  const acc = new Map<string, { avail: number[]; prices: number[] }>();
  for (const compId of compIds) {
    const snapDate = newest.get(compId);
    if (!snapDate) continue;
    const { data: rows } = await admin
      .from("comp_snapshot")
      .select("stay_date, available, price_cents")
      .eq("comp_id", compId)
      .eq("snapshot_date", snapDate)
      .gte("stay_date", fromDate)
      .lte("stay_date", toDate);
    for (const row of rows ?? []) {
      const a = acc.get(row.stay_date) ?? { avail: [], prices: [] };
      if (row.available !== null) a.avail.push(row.available ? 0 : 1);
      if (row.price_cents !== null) a.prices.push(row.price_cents);
      acc.set(row.stay_date, a);
    }
  }

  for (const [stay_date, { avail, prices }] of acc) {
    const sorted = [...prices].sort((x, y) => x - y);
    byDate.set(stay_date, {
      stay_date,
      occupancy: avail.length ? avail.reduce((s, x) => s + x, 0) / avail.length : null,
      compsCounted: avail.length,
      p25: sorted.length ? percentile(sorted, 0.25) : null,
      p50: sorted.length ? percentile(sorted, 0.5) : null,
      p75: sorted.length ? percentile(sorted, 0.75) : null,
      p90: sorted.length ? percentile(sorted, 0.9) : null,
      pricesCounted: sorted.length,
    });
  }
  return byDate;
}

/** Our own listing's occupancy over the next N nights (bookings + blocks). */
export function occupancyWindow(occupied: Set<string>, today: string, days: number): number {
  let n = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(today + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + i);
    if (occupied.has(d.toISOString().slice(0, 10))) n++;
  }
  return days > 0 ? Math.round((n / days) * 100) : 0;
}
