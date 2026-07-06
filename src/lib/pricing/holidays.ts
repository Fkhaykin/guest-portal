// Recurring US holiday calendar for the pricing engine. Holidays auto-compute
// their dates every year (fixed-date and floating alike) and expand into
// premium night windows, so the config never goes stale the way hardcoded
// event dates do. Premiums are calibrated to the premiums PriceLabs actually
// applies (extracted from its pushed prices vs same-weekday baselines).

export interface HolidayRule {
  key: string;
  pct: number;
  enabled: boolean;
}

export interface HolidayDef {
  key: string;
  label: string;
  defaultPct: number;
  enabledByDefault: boolean;
  /** Anchor date (the holiday itself) for a given year, in UTC. */
  anchor: (year: number) => Date;
  /** Day offsets from the anchor that get the premium (the rental-valuable
   *  nights — e.g. the long weekend, or the party eves). */
  offsets: number[];
}

function utc(year: number, month0: number, day: number): Date {
  return new Date(Date.UTC(year, month0, day));
}

/** Nth given weekday of a month (1-indexed n). weekday: 0=Sun..6=Sat. */
function nthWeekday(year: number, month0: number, weekday: number, n: number): Date {
  const first = utc(year, month0, 1);
  const shift = (weekday - first.getUTCDay() + 7) % 7;
  return utc(year, month0, 1 + shift + (n - 1) * 7);
}

/** Last given weekday of a month. */
function lastWeekday(year: number, month0: number, weekday: number): Date {
  const last = utc(year, month0 + 1, 0); // last day of month
  const shift = (last.getUTCDay() - weekday + 7) % 7;
  return utc(year, month0, last.getUTCDate() - shift);
}

// Windows: single-day holidays extend into their surrounding weekend nights via
// day-of-week (so they don't need bespoke logic); Monday holidays cover the
// Fri/Sat/Sun nights of the long weekend; the party holidays cover their eves.
// Default premiums are calibrated to the premiums PriceLabs actually applies in
// this market (solved from its pushed prices against each house's base/season/
// day-of-week, median across all houses).
export const HOLIDAY_DEFS: HolidayDef[] = [
  { key: "nye", label: "New Year's Eve", defaultPct: 330, enabledByDefault: true, anchor: (y) => utc(y, 11, 31), offsets: [-1, 0] },
  { key: "mlk", label: "MLK Day", defaultPct: 40, enabledByDefault: true, anchor: (y) => nthWeekday(y, 0, 1, 3), offsets: [-3, -2, -1] },
  { key: "valentines", label: "Valentine's Day", defaultPct: 185, enabledByDefault: true, anchor: (y) => utc(y, 1, 14), offsets: [-1, 0] },
  { key: "presidents", label: "Presidents Day", defaultPct: 55, enabledByDefault: true, anchor: (y) => nthWeekday(y, 1, 1, 3), offsets: [-3, -2, -1] },
  { key: "memorial", label: "Memorial Day", defaultPct: 155, enabledByDefault: true, anchor: (y) => lastWeekday(y, 4, 1), offsets: [-3, -2, -1] },
  { key: "juneteenth", label: "Juneteenth", defaultPct: 40, enabledByDefault: true, anchor: (y) => utc(y, 5, 19), offsets: [-1, 0] },
  { key: "july4", label: "July 4th", defaultPct: 245, enabledByDefault: true, anchor: (y) => utc(y, 6, 4), offsets: [-1, 0] },
  { key: "laborday", label: "Labor Day", defaultPct: 150, enabledByDefault: true, anchor: (y) => nthWeekday(y, 8, 1, 1), offsets: [-3, -2, -1] },
  { key: "indigenous", label: "Columbus/Indigenous Day", defaultPct: 40, enabledByDefault: true, anchor: (y) => nthWeekday(y, 9, 1, 2), offsets: [-3, -2, -1] },
  { key: "halloween", label: "Halloween", defaultPct: 45, enabledByDefault: true, anchor: (y) => utc(y, 9, 31), offsets: [-1, 0] },
  { key: "thanksgiving", label: "Thanksgiving", defaultPct: 190, enabledByDefault: true, anchor: (y) => nthWeekday(y, 10, 4, 4), offsets: [-1, 0, 1, 2] },
  { key: "christmas", label: "Christmas", defaultPct: 160, enabledByDefault: true, anchor: (y) => utc(y, 11, 25), offsets: [-2, -1, 0, 1] },
];

export const DEFAULT_HOLIDAYS: HolidayRule[] = HOLIDAY_DEFS.map((h) => ({
  key: h.key,
  pct: h.defaultPct,
  enabled: h.enabledByDefault,
}));

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Map of stay_date → { pct, label } for all enabled holidays whose windows
 *  fall in [startISO, endISO]. Computed across every year the range touches. */
export function holidayByDate(
  holidays: HolidayRule[] | undefined,
  startISO: string,
  endISO: string
): Map<string, { pct: number; label: string }> {
  const out = new Map<string, { pct: number; label: string }>();
  if (!holidays?.length) return out;
  const byKey = new Map(holidays.map((h) => [h.key, h]));
  const startYear = new Date(startISO + "T00:00:00Z").getUTCFullYear();
  const endYear = new Date(endISO + "T00:00:00Z").getUTCFullYear();

  for (const def of HOLIDAY_DEFS) {
    const rule = byKey.get(def.key);
    if (!rule || !rule.enabled || rule.pct === 0) continue;
    for (let year = startYear; year <= endYear; year++) {
      const anchor = def.anchor(year);
      for (const off of def.offsets) {
        const d = new Date(anchor);
        d.setUTCDate(d.getUTCDate() + off);
        const key = iso(d);
        if (key < startISO || key > endISO) continue;
        // Strongest premium wins if two holidays overlap a night.
        const existing = out.get(key);
        if (!existing || Math.abs(rule.pct) > Math.abs(existing.pct)) {
          out.set(key, { pct: rule.pct, label: def.label });
        }
      }
    }
  }
  return out;
}
