// In-house dynamic pricing engine. Pure computation — no I/O — so it can be
// unit-tested and run identically in the daily cron and the Pricing Lab
// preview endpoint.
//
// Model (mirrors how PriceLabs stacks factors, using our own transparent rules):
//   seasonal base  = base × (1 + season%)
//   structural     = seasonal base × (1 + dow% + event%)
//   dynamic        = lead-time and pace premiums stack; among the DISCOUNTS
//                    (lead-time, pace, gap) only the single largest applies —
//                    PriceLabs' anti-compounding rule
//   smoothing      = the lead-time+pace dynamic is capped to ±smoothingPct
//                    change between adjacent nights (gap spikes and structural
//                    weekend/event jumps are intentionally NOT smoothed)
//   price          = structural × (1 + smoothed dynamic + gap%), clamped to
//                    [min, max]; date overrides pierce everything
//   min-stay       = seasonal default → last-minute drop → gap length → override

export type SeasonRule = { from: string; to: string; pct: number; label?: string }; // "MM-DD" recurring, inclusive, may wrap year-end
export type EventRule = { from: string; to: string; pct: number; label?: string }; // "YYYY-MM-DD" inclusive
export type LeadtimeStep = { maxDays: number; pct: number }; // sorted by maxDays asc; first match wins
export type PaceBucket = { days: number; targetOcc: number }; // sorted by days asc
export type MinStaySeason = { from: string; to: string; value: number }; // "MM-DD"
export type DateOverride = { date: string; price_cents?: number; min_stay?: number; label?: string };

export interface PricingRules {
  seasons: SeasonRule[];
  dowPct: number[]; // 7 entries, Sun..Sat, percent
  events: EventRule[];
  leadtime: LeadtimeStep[];
  pace: { enabled: boolean; buckets: PaceBucket[]; maxPct: number };
  gap: { maxGapNights: number; pct: number; setMinStay: boolean };
  minStay: {
    base: number;
    seasons: MinStaySeason[];
    lastMinute: { withinDays: number; value: number } | null;
  };
  smoothingPct: number;
  overrides: DateOverride[];
}

export interface EngineConfig {
  nickname: string;
  base_price_cents: number;
  min_price_cents: number;
  max_price_cents: number;
  rules: PricingRules;
}

export interface RateFactors {
  base_cents: number;
  season_pct: number;
  dow_pct: number;
  event_pct: number;
  leadtime_pct: number;
  pace_pct: number;
  gap_pct: number;
  discount_src: "leadtime" | "pace" | "gap" | null;
  smoothing_adj_pct: number;
  pre_clamp_cents: number;
  clamped: "min" | "max" | null;
  override: boolean;
  occupied: boolean;
}

export interface ComputedRate {
  date: string;
  price_cents: number;
  min_stay: number;
  factors: RateFactors;
}

export interface EngineInput {
  today: string; // "YYYY-MM-DD" in the property's timezone
  horizonDays: number;
  occupiedNights: Set<string>; // booked or blocked nights for the whole house
}

export const DEFAULT_RULES: PricingRules = {
  seasons: [],
  dowPct: [0, 0, 0, 0, 0, 15, 15],
  events: [],
  leadtime: [
    { maxDays: 1, pct: -20 },
    { maxDays: 3, pct: -15 },
    { maxDays: 7, pct: -10 },
    { maxDays: 14, pct: -5 },
    { maxDays: 180, pct: 0 },
    { maxDays: 9999, pct: 10 },
  ],
  pace: {
    enabled: true,
    buckets: [
      { days: 30, targetOcc: 0.6 },
      { days: 60, targetOcc: 0.45 },
      { days: 90, targetOcc: 0.35 },
    ],
    maxPct: 15,
  },
  gap: { maxGapNights: 2, pct: -15, setMinStay: true },
  minStay: { base: 2, seasons: [], lastMinute: { withinDays: 7, value: 2 } },
  smoothingPct: 15,
  overrides: [],
};

// ---------------------------------------------------------------------------
// Date helpers (UTC-anchored so results don't depend on server timezone)

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function dayOfWeek(iso: string): number {
  return new Date(iso + "T00:00:00Z").getUTCDay();
}

/** Is MM-DD of `iso` within the recurring [from, to] MM-DD range (inclusive)?
 *  Ranges may wrap the year end (e.g. 12-15 → 03-15). */
function inRecurringRange(iso: string, from: string, to: string): boolean {
  const mmdd = iso.slice(5);
  if (from <= to) return mmdd >= from && mmdd <= to;
  return mmdd >= from || mmdd <= to; // wraps year end
}

// ---------------------------------------------------------------------------

function seasonPct(rules: PricingRules, date: string): number {
  for (const s of rules.seasons) {
    if (inRecurringRange(date, s.from, s.to)) return s.pct;
  }
  return 0;
}

function eventPct(rules: PricingRules, date: string): number {
  let best = 0;
  for (const ev of rules.events) {
    if (date >= ev.from && date <= ev.to && Math.abs(ev.pct) > Math.abs(best)) best = ev.pct;
  }
  return best;
}

function leadtimePct(rules: PricingRules, daysOut: number): number {
  for (const step of rules.leadtime) {
    if (daysOut <= step.maxDays) return step.pct;
  }
  return 0;
}

/** Occupancy-vs-target controller. Under-booked windows discount, over-booked
 *  windows premium: half a percent of price for every percent of occupancy
 *  gap, capped at ±maxPct. Needs zero market data. */
function pacePct(rules: PricingRules, daysOut: number, occByBucket: Map<number, number>): number {
  if (!rules.pace.enabled) return 0;
  for (const b of rules.pace.buckets) {
    if (daysOut <= b.days) {
      const occ = occByBucket.get(b.days) ?? 0;
      const raw = (occ - b.targetOcc) * 100 * 0.5;
      return Math.max(-rules.pace.maxPct, Math.min(rules.pace.maxPct, Math.round(raw * 10) / 10));
    }
  }
  return 0;
}

/** Orphan gaps: runs of free nights of length ≤ maxGapNights bounded by an
 *  occupied night on the right and an occupied night (or today) on the left —
 *  short windows a full-length stay can no longer fill. Returns gap length per
 *  date in a gap. */
export function findGapNights(
  input: EngineInput,
  maxGapNights: number
): Map<string, number> {
  const gaps = new Map<string, number>();
  if (maxGapNights <= 0) return gaps;
  let run: string[] = [];
  let leftBounded = true; // horizon start (today) counts as a left boundary
  for (let i = 0; i < input.horizonDays; i++) {
    const date = addDays(input.today, i);
    if (input.occupiedNights.has(date)) {
      if (leftBounded && run.length > 0 && run.length <= maxGapNights) {
        for (const d of run) gaps.set(d, run.length);
      }
      run = [];
      leftBounded = true;
    } else {
      run.push(date);
    }
  }
  return gaps;
}

function occupancyByBucket(input: EngineInput, buckets: PaceBucket[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const b of buckets) {
    let occupied = 0;
    for (let i = 0; i < b.days; i++) {
      if (input.occupiedNights.has(addDays(input.today, i))) occupied++;
    }
    out.set(b.days, b.days > 0 ? occupied / b.days : 0);
  }
  return out;
}

function minStayFor(
  rules: PricingRules,
  date: string,
  daysOut: number,
  gapLen: number | undefined
): number {
  let stay = rules.minStay.base;
  for (const s of rules.minStay.seasons) {
    if (inRecurringRange(date, s.from, s.to)) stay = s.value;
  }
  if (rules.minStay.lastMinute && daysOut <= rules.minStay.lastMinute.withinDays) {
    stay = Math.min(stay, rules.minStay.lastMinute.value);
  }
  if (gapLen !== undefined && rules.gap.setMinStay) {
    stay = Math.min(stay, gapLen);
  }
  return Math.max(1, stay);
}

// ---------------------------------------------------------------------------

export function computeRates(cfg: EngineConfig, input: EngineInput): ComputedRate[] {
  const rules: PricingRules = { ...DEFAULT_RULES, ...cfg.rules };
  const gaps = findGapNights(input, rules.gap.maxGapNights);
  const occBuckets = occupancyByBucket(input, rules.pace.buckets);
  const overrides = new Map(rules.overrides.map((o) => [o.date, o]));

  // Pass 1: per-date factors and the raw lead-time+pace dynamic.
  type Working = {
    date: string;
    structuralCents: number;
    dynamicPct: number; // lead-time + pace combined (pre-smoothing)
    factors: RateFactors;
    gapLen: number | undefined;
    daysOut: number;
  };
  const working: Working[] = [];

  for (let i = 0; i < input.horizonDays; i++) {
    const date = addDays(input.today, i);
    const daysOut = i;
    const season = seasonPct(rules, date);
    const dow = rules.dowPct[dayOfWeek(date)] ?? 0;
    const event = eventPct(rules, date);
    const lt = leadtimePct(rules, daysOut);
    const pace = pacePct(rules, daysOut, occBuckets);
    const gapLen = gaps.get(date);
    const gapPct = gapLen !== undefined ? rules.gap.pct : 0;

    // Premiums stack; discounts compete — only the single largest applies.
    const premiums = Math.max(lt, 0) + Math.max(pace, 0);
    const discounts: { src: RateFactors["discount_src"]; pct: number }[] = [
      { src: "leadtime", pct: Math.min(lt, 0) },
      { src: "pace", pct: Math.min(pace, 0) },
      { src: "gap", pct: Math.min(gapPct, 0) },
    ];
    const worst = discounts.reduce((a, b) => (b.pct < a.pct ? b : a));
    const appliedDiscountSrc = worst.pct < 0 ? worst.src : null;

    const seasonalBase = cfg.base_price_cents * (1 + season / 100);
    const structuralCents = seasonalBase * (1 + (dow + event) / 100);
    // Gap is spiky by design; keep it out of the smoothed dynamic.
    const gapPart = appliedDiscountSrc === "gap" ? worst.pct : 0;
    const smoothablePart = premiums + (appliedDiscountSrc !== "gap" ? worst.pct : 0);

    working.push({
      date,
      structuralCents,
      dynamicPct: smoothablePart,
      gapLen,
      daysOut,
      factors: {
        base_cents: cfg.base_price_cents,
        season_pct: season,
        dow_pct: dow,
        event_pct: event,
        leadtime_pct: lt,
        pace_pct: pace,
        gap_pct: gapPart,
        discount_src: appliedDiscountSrc,
        smoothing_adj_pct: 0,
        pre_clamp_cents: 0,
        clamped: null,
        override: false,
        occupied: input.occupiedNights.has(date),
      },
    });
  }

  // Pass 2: smooth the lead-time+pace dynamic so adjacent nights never jump
  // more than smoothingPct (the repeat-guest "$179 one night, $329 the next"
  // complaint). Forward pass anchored on the first date.
  if (rules.smoothingPct > 0) {
    for (let i = 1; i < working.length; i++) {
      const prev = working[i - 1].dynamicPct;
      const cur = working[i].dynamicPct;
      const capped = Math.max(prev - rules.smoothingPct, Math.min(prev + rules.smoothingPct, cur));
      if (capped !== cur) {
        working[i].factors.smoothing_adj_pct = Math.round((capped - cur) * 10) / 10;
        working[i].dynamicPct = capped;
      }
    }
  }

  // Pass 3: final price = structural × (1 + dynamic + gap), clamp, override.
  return working.map((w) => {
    const raw = w.structuralCents * (1 + (w.dynamicPct + w.factors.gap_pct) / 100);
    w.factors.pre_clamp_cents = Math.round(raw);

    let price = Math.round(raw);
    if (price < cfg.min_price_cents) {
      price = cfg.min_price_cents;
      w.factors.clamped = "min";
    } else if (price > cfg.max_price_cents) {
      price = cfg.max_price_cents;
      w.factors.clamped = "max";
    }

    let minStay = minStayFor(rules, w.date, w.daysOut, w.gapLen);

    const ov = overrides.get(w.date);
    if (ov) {
      w.factors.override = true;
      if (typeof ov.price_cents === "number") price = ov.price_cents;
      if (typeof ov.min_stay === "number") minStay = Math.max(1, ov.min_stay);
    }

    // Round to whole dollars — cents-precision prices look algorithmic to guests.
    price = Math.round(price / 100) * 100;

    return { date: w.date, price_cents: price, min_stay: minStay, factors: w.factors };
  });
}

/** Today's date string in the property's timezone (all houses are Poconos). */
export function todayInTz(tz = "America/New_York"): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: tz });
}
