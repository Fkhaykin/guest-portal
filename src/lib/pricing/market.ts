// Market signals from the comp set.
//
// The heavy lifting happens once daily: aggregateMarketPulse() collapses the
// comp_snapshot history into one market_pulse row per (house, stay date) —
// occupancy, price percentiles, and the booking-velocity signal (pickup_1d /
// pickup_7d: of the comps that had a date open 1 / ~7 snapshots ago, what
// fraction has since gone unavailable). The engine and the UI then read those
// cheap pre-aggregated rows.

import { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

export const PULSE_HORIZON_DAYS = 180;

export interface PulseRow {
  nickname: string;
  snapshot_date: string;
  stay_date: string;
  comps_tracked: number;
  comps_available: number;
  occupancy: number | null;
  pickup_1d: number | null;
  pickup_7d: number | null;
  p25_cents: number | null;
  p50_cents: number | null;
  p75_cents: number | null;
  p90_cents: number | null;
  prices_counted: number;
  lf_comps_tracked: number | null;
  lf_occupancy: number | null;
  lf_p50_cents: number | null;
}

function percentile(sorted: number[], p: number): number {
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo));
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Aggregate today's comp snapshots (plus 1-day / ~7-day lookbacks for
 *  velocity) into market_pulse rows for one house. */
export async function aggregateMarketPulse(
  admin: Admin,
  nickname: string,
  today: string
): Promise<{ dates: number; comps: number }> {
  const { data: comps } = await admin
    .from("comp_listing")
    .select("id, is_lakefront")
    .ilike("nickname", nickname)
    .eq("is_self", false)
    .eq("is_active", true);
  if (!comps?.length) return { dates: 0, comps: 0 };

  const horizonEnd = addDays(today, PULSE_HORIZON_DAYS);

  type DayAgg = {
    tracked: number;
    available: number;
    prices: number[];
    lfTracked: number;
    lfUnavailable: number;
    lfPrices: number[];
    openPrev1: number; // comps open at the 1-back snapshot
    bookedSince1: number; // …of those, now unavailable
    openPrev7: number;
    bookedSince7: number;
  };
  const byDate = new Map<string, DayAgg>();
  const agg = (d: string): DayAgg => {
    let a = byDate.get(d);
    if (!a) {
      a = { tracked: 0, available: 0, prices: [], lfTracked: 0, lfUnavailable: 0, lfPrices: [], openPrev1: 0, bookedSince1: 0, openPrev7: 0, bookedSince7: 0 };
      byDate.set(d, a);
    }
    return a;
  };

  for (const comp of comps) {
    // This comp's snapshot dates, newest first.
    const { data: snapDates } = await admin
      .from("comp_snapshot")
      .select("snapshot_date")
      .eq("comp_id", comp.id)
      .order("snapshot_date", { ascending: false })
      .limit(400);
    const distinct = [...new Set((snapDates ?? []).map((r) => r.snapshot_date as string))];
    if (distinct.length === 0) continue;
    const latest = distinct[0];
    const prev1 = distinct[1] ?? null;
    // closest snapshot to 7 days before latest
    const target7 = addDays(latest, -7);
    const prev7 =
      distinct.find((d) => d <= target7) ?? (distinct.length > 1 ? distinct[distinct.length - 1] : null);

    const load = async (snapshotDate: string) => {
      const { data } = await admin
        .from("comp_snapshot")
        .select("stay_date, available, price_cents")
        .eq("comp_id", comp.id)
        .eq("snapshot_date", snapshotDate)
        .gte("stay_date", today)
        .lte("stay_date", horizonEnd)
        .limit(400);
      return data ?? [];
    };

    const latestRows = await load(latest);
    const prev1Rows = prev1 ? await load(prev1) : [];
    const prev7Rows = prev7 && prev7 !== prev1 ? await load(prev7) : prev1Rows;
    const avail1 = new Map(prev1Rows.map((r) => [r.stay_date, r.available]));
    const avail7 = new Map(prev7Rows.map((r) => [r.stay_date, r.available]));

    for (const row of latestRows) {
      const a = agg(row.stay_date);
      if (row.available === null) continue;
      a.tracked++;
      if (row.available) a.available++;
      if (row.price_cents !== null) a.prices.push(row.price_cents);
      if (comp.is_lakefront) {
        a.lfTracked++;
        if (!row.available) a.lfUnavailable++;
        if (row.price_cents !== null) a.lfPrices.push(row.price_cents);
      }
      const was1 = avail1.get(row.stay_date);
      if (was1 === true) {
        a.openPrev1++;
        if (!row.available) a.bookedSince1++;
      }
      const was7 = avail7.get(row.stay_date);
      if (was7 === true) {
        a.openPrev7++;
        if (!row.available) a.bookedSince7++;
      }
    }
  }

  const rows = [...byDate.entries()].map(([stay_date, a]) => {
    const prices = a.prices.sort((x, y) => x - y);
    const lfPrices = a.lfPrices.sort((x, y) => x - y);
    return {
      nickname,
      snapshot_date: today,
      stay_date,
      comps_tracked: a.tracked,
      comps_available: a.available,
      occupancy: a.tracked ? (a.tracked - a.available) / a.tracked : null,
      pickup_1d: a.openPrev1 ? a.bookedSince1 / a.openPrev1 : null,
      pickup_7d: a.openPrev7 ? a.bookedSince7 / a.openPrev7 : null,
      p25_cents: prices.length ? percentile(prices, 0.25) : null,
      p50_cents: prices.length ? percentile(prices, 0.5) : null,
      p75_cents: prices.length ? percentile(prices, 0.75) : null,
      p90_cents: prices.length ? percentile(prices, 0.9) : null,
      prices_counted: prices.length,
      lf_comps_tracked: a.lfTracked || null,
      lf_occupancy: a.lfTracked ? a.lfUnavailable / a.lfTracked : null,
      lf_p50_cents: lfPrices.length ? percentile(lfPrices, 0.5) : null,
    };
  });

  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await admin
      .from("market_pulse")
      .upsert(rows.slice(i, i + 500), { onConflict: "nickname,snapshot_date,stay_date" });
    if (error) throw new Error(`market_pulse upsert: ${error.message}`);
  }
  return { dates: rows.length, comps: comps.length };
}

/** Latest pulse rows for a house (one per stay date). */
export async function loadLatestPulse(admin: Admin, nickname: string): Promise<PulseRow[]> {
  const { data: latest } = await admin
    .from("market_pulse")
    .select("snapshot_date")
    .ilike("nickname", nickname)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!latest) return [];
  const { data } = await admin
    .from("market_pulse")
    .select("*")
    .ilike("nickname", nickname)
    .eq("snapshot_date", latest.snapshot_date)
    .order("stay_date")
    .limit(PULSE_HORIZON_DAYS + 10);
  return (data ?? []) as PulseRow[];
}

/** Velocity input for the engine: stay date → 7-day pickup fraction. */
export async function loadVelocityByDate(admin: Admin, nickname: string): Promise<Map<string, number>> {
  const pulse = await loadLatestPulse(admin, nickname);
  const map = new Map<string, number>();
  for (const row of pulse) {
    if (row.pickup_7d !== null) map.set(row.stay_date, row.pickup_7d);
  }
  return map;
}

// Demand needs a reliable occupancy estimate; ignore dates tracked by too few
// comps (thin data would produce noisy scarcity premiums).
const DEMAND_MIN_COMPS = 8;

/** Demand input for the engine: stay date → comp-set occupancy (0..1). */
export async function loadDemandOccByDate(admin: Admin, nickname: string): Promise<Map<string, number>> {
  const pulse = await loadLatestPulse(admin, nickname);
  const map = new Map<string, number>();
  for (const row of pulse) {
    if (row.occupancy !== null && row.comps_tracked >= DEMAND_MIN_COMPS) {
      map.set(row.stay_date, row.occupancy);
    }
  }
  return map;
}

/** "Last seen published price" per stay date — the nightly price actually live
 *  on our own Airbnb listing, from price-probes on the is_self comp. Mirrors
 *  PriceLabs' dotted published-price line. */
export async function loadPublishedPrices(
  admin: Admin,
  nickname: string,
  fromDate: string
): Promise<Map<string, number>> {
  const { data: self } = await admin
    .from("comp_listing")
    .select("id")
    .ilike("nickname", nickname)
    .eq("is_self", true)
    .limit(1)
    .maybeSingle();
  const out = new Map<string, number>();
  if (!self) return out;

  const { data: latest } = await admin
    .from("comp_snapshot")
    .select("snapshot_date")
    .eq("comp_id", self.id)
    .not("price_cents", "is", null)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!latest) return out;

  const { data: rows } = await admin
    .from("comp_snapshot")
    .select("stay_date, price_cents")
    .eq("comp_id", self.id)
    .eq("snapshot_date", latest.snapshot_date)
    .not("price_cents", "is", null)
    .gte("stay_date", fromDate);
  for (const r of rows ?? []) if (r.price_cents !== null) out.set(r.stay_date, r.price_cents);
  return out;
}

/** Our own listing's occupancy over the next N nights (bookings + blocks). */
export function occupancyWindow(occupied: Set<string>, today: string, days: number): number {
  let n = 0;
  for (let i = 0; i < days; i++) {
    if (occupied.has(addDays(today, i))) n++;
  }
  return days > 0 ? Math.round((n / days) * 100) : 0;
}

/* ------------------------------------------------------------------ */
/* Market position: ours vs the comp set over 30/60/90 days + weekend  */
/* vs weeknight averages. Computed from already-loaded rows.           */

export interface PositionWindow {
  days: number;
  ourOcc: number; // %
  marketOcc: number | null; // %
  lfOcc: number | null; // % lakefront comps only
  ourAvgCents: number | null;
  marketAvgCents: number | null; // mean of daily p50 over the SAME nights as ourAvg
  lfAvgCents: number | null;
  nights: number; // paired sample size behind ourAvg/marketAvg
}

export interface MarketPosition {
  windows: PositionWindow[];
  weekend: { ourAvgCents: number | null; marketAvgCents: number | null };
  weeknight: { ourAvgCents: number | null; marketAvgCents: number | null };
}

export function computePosition(
  ourRates: { stay_date: string; our_price_cents: number | null; is_booked: boolean }[],
  pulse: PulseRow[],
  occupied: Set<string>,
  today: string
): MarketPosition {
  const pulseByDate = new Map(pulse.map((p) => [p.stay_date, p]));
  const mean = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

  const windows: PositionWindow[] = [30, 60, 90].map((days) => {
    const end = addDays(today, days);
    // Price comparison uses PAIRED samples only: a night counts toward both
    // averages only when our price exists (open, priced) AND the market has a
    // median for it — otherwise cheap open weeknights get compared against
    // weekend-inclusive market medians and the gap reads systematically wrong.
    const our: number[] = [];
    const market: number[] = [];
    const lf: number[] = [];
    const occs: number[] = [];
    const lfOccs: number[] = [];
    for (const r of ourRates) {
      if (r.stay_date < today || r.stay_date >= end) continue;
      const p = pulseByDate.get(r.stay_date);
      if (!r.is_booked && r.our_price_cents != null && p?.p50_cents != null) {
        our.push(r.our_price_cents);
        market.push(p.p50_cents);
        if (p.lf_p50_cents != null) lf.push(p.lf_p50_cents);
      }
      if (p?.occupancy != null) occs.push(p.occupancy);
      if (p?.lf_occupancy != null) lfOccs.push(p.lf_occupancy);
    }
    return {
      days,
      ourOcc: occupancyWindow(occupied, today, days),
      marketOcc: occs.length ? Math.round((occs.reduce((a, b) => a + b, 0) / occs.length) * 100) : null,
      lfOcc: lfOccs.length ? Math.round((lfOccs.reduce((a, b) => a + b, 0) / lfOccs.length) * 100) : null,
      ourAvgCents: mean(our),
      marketAvgCents: mean(market),
      lfAvgCents: lf.length ? mean(lf) : null,
      nights: our.length,
    };
  });

  const end90 = addDays(today, 90);
  const isWeekend = (d: string) => {
    const dow = new Date(d + "T00:00:00Z").getUTCDay();
    return dow === 5 || dow === 6; // Fri, Sat nights
  };
  const ourWe: number[] = [];
  const ourWn: number[] = [];
  const mktWe: number[] = [];
  const mktWn: number[] = [];
  for (const r of ourRates) {
    if (r.stay_date < today || r.stay_date >= end90) continue;
    const p = pulseByDate.get(r.stay_date);
    if (r.is_booked || r.our_price_cents == null || p?.p50_cents == null) continue; // paired only
    if (isWeekend(r.stay_date)) {
      ourWe.push(r.our_price_cents);
      mktWe.push(p.p50_cents);
    } else {
      ourWn.push(r.our_price_cents);
      mktWn.push(p.p50_cents);
    }
  }

  return {
    windows,
    weekend: { ourAvgCents: mean(ourWe), marketAvgCents: mean(mktWe) },
    weeknight: { ourAvgCents: mean(ourWn), marketAvgCents: mean(mktWn) },
  };
}
