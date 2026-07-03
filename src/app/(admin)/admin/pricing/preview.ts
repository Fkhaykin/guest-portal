// Client-side price preview for the Customizations modal. The engine is pure,
// so we can recompute what the draft rules would produce against the house's
// real calendar and compare to the current prices — PriceLabs' "Preview
// Prices" panel, without a round-trip.

import { computeRates, DEFAULT_RULES, type PricingRules } from "@/lib/pricing/engine";
import type { PricingConfig, SnapshotRow, MarketPoint } from "./types";

export interface PreviewNight {
  date: string;
  oldCents: number | null;
  newCents: number;
  deltaPct: number | null;
}

export interface PreviewResult {
  nights: PreviewNight[];
  changed: number;
  oldAvg: number | null;
  newAvg: number | null;
  avgDeltaPct: number | null;
}

function sanitize(rules: PricingRules): PricingRules {
  return {
    ...DEFAULT_RULES,
    ...rules,
    seasons: (rules.seasons ?? []).filter((s) => s.from && s.to),
    events: (rules.events ?? []).filter((e) => e.from && e.to),
    overrides: (rules.overrides ?? []).filter((o) => o.date),
    minStay: { ...rules.minStay, seasons: (rules.minStay?.seasons ?? []).filter((s) => s.from && s.to) },
  };
}

export function computePreview(
  config: PricingConfig,
  draftRules: PricingRules,
  snapshot: SnapshotRow[],
  market: MarketPoint[],
  today: string,
  days = 30
): PreviewResult {
  const occupiedNights = new Set(snapshot.filter((r) => r.is_booked).map((r) => r.stay_date));
  const velocityByDate = new Map<string, number>();
  for (const m of market) if (m.pickup_7d != null) velocityByDate.set(m.stay_date, m.pickup_7d);
  const oldByDate = new Map(snapshot.map((r) => [r.stay_date, r.our_price_cents]));

  const horizon = Math.min(days * 3, 120); // compute a bit past the display window
  const rates = computeRates(
    { ...config, rules: sanitize(draftRules) },
    { today, horizonDays: horizon, occupiedNights, velocityByDate }
  );

  const nights: PreviewNight[] = [];
  for (const r of rates) {
    if (r.factors.occupied) continue;
    const oldCents = oldByDate.get(r.date) ?? null;
    const deltaPct = oldCents ? Math.round(((r.price_cents - oldCents) / oldCents) * 1000) / 10 : null;
    nights.push({ date: r.date, oldCents, newCents: r.price_cents, deltaPct });
    if (nights.length >= days) break;
  }

  const withOld = nights.filter((n) => n.oldCents != null);
  const changed = nights.filter((n) => n.oldCents != null && n.oldCents !== n.newCents).length;
  const oldAvg = withOld.length ? Math.round(withOld.reduce((s, n) => s + n.oldCents!, 0) / withOld.length) : null;
  const newAvg = withOld.length ? Math.round(withOld.reduce((s, n) => s + n.newCents, 0) / withOld.length) : null;
  const avgDeltaPct = oldAvg && newAvg ? Math.round(((newAvg - oldAvg) / oldAvg) * 1000) / 10 : null;

  return { nights, changed, oldAvg, newAvg, avgDeltaPct };
}
