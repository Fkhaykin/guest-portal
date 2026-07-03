import { describe, it, expect } from "vitest";
import {
  computeRates,
  findGapNights,
  addDays,
  DEFAULT_RULES,
  type EngineConfig,
  type EngineInput,
  type PricingRules,
} from "./engine";

const TODAY = "2026-07-06"; // a Monday

function cfg(rules: Partial<PricingRules> = {}, anchors: Partial<EngineConfig> = {}): EngineConfig {
  return {
    nickname: "testhouse",
    base_price_cents: 40000,
    min_price_cents: 20000,
    max_price_cents: 100000,
    ...anchors,
    rules: {
      ...DEFAULT_RULES,
      // Neutral defaults so each test enables exactly what it exercises.
      seasons: [],
      dowPct: [0, 0, 0, 0, 0, 0, 0],
      events: [],
      leadtime: [{ maxDays: 9999, pct: 0 }],
      pace: { enabled: false, buckets: [], maxPct: 15 },
      gap: { maxGapNights: 0, pct: 0, setMinStay: false },
      minStay: { base: 2, seasons: [], lastMinute: null },
      smoothingPct: 0,
      overrides: [],
      velocity: { enabled: false, tiers: [], maxPct: 15 },
      ...rules,
    },
  };
}

function input(overrides: Partial<EngineInput> = {}): EngineInput {
  return { today: TODAY, horizonDays: 30, occupiedNights: new Set(), ...overrides };
}

function rateOn(rates: ReturnType<typeof computeRates>, date: string) {
  const r = rates.find((x) => x.date === date);
  if (!r) throw new Error(`no rate for ${date}`);
  return r;
}

describe("seasons", () => {
  it("applies the season pct as the base shaper", () => {
    const rates = computeRates(cfg({ seasons: [{ from: "07-01", to: "08-31", pct: 25 }] }), input());
    expect(rateOn(rates, TODAY).price_cents).toBe(50000);
  });

  it("handles ranges that wrap the year end", () => {
    const c = cfg({ seasons: [{ from: "12-15", to: "03-15", pct: 20 }] });
    const rates = computeRates(c, { ...input(), today: "2026-12-10", horizonDays: 30 });
    expect(rateOn(rates, "2026-12-10").price_cents).toBe(40000); // before season
    expect(rateOn(rates, "2026-12-20").price_cents).toBe(48000); // inside wrap
    expect(rateOn(rates, "2027-01-05").price_cents).toBe(48000); // after new year
  });
});

describe("day-of-week and events", () => {
  it("applies weekend premiums", () => {
    const rates = computeRates(cfg({ dowPct: [0, 0, 0, 0, 0, 20, 20] }), input());
    expect(rateOn(rates, "2026-07-10").price_cents).toBe(48000); // Friday
    expect(rateOn(rates, "2026-07-08").price_cents).toBe(40000); // Wednesday
  });

  it("applies the strongest overlapping event", () => {
    const rates = computeRates(
      cfg({
        events: [
          { from: "2026-07-10", to: "2026-07-12", pct: 10 },
          { from: "2026-07-11", to: "2026-07-11", pct: 30 },
        ],
      }),
      input()
    );
    expect(rateOn(rates, "2026-07-10").price_cents).toBe(44000);
    expect(rateOn(rates, "2026-07-11").price_cents).toBe(52000);
  });
});

describe("discount competition (PriceLabs anti-compounding rule)", () => {
  it("applies only the single largest discount", () => {
    // Night in a 1-night gap (gap −15) and 1 day out (leadtime −20): −20 wins.
    const occupied = new Set([addDays(TODAY, 0), addDays(TODAY, 2)]);
    const c = cfg({
      leadtime: [
        { maxDays: 1, pct: -20 },
        { maxDays: 9999, pct: 0 },
      ],
      gap: { maxGapNights: 2, pct: -15, setMinStay: true },
    });
    const rates = computeRates(c, input({ occupiedNights: occupied }));
    const gapNight = rateOn(rates, addDays(TODAY, 1));
    expect(gapNight.price_cents).toBe(32000); // −20%, not −35%
    expect(gapNight.factors.discount_src).toBe("leadtime");
  });

  it("premiums stack on top of the surviving discount", () => {
    const c = cfg({
      dowPct: [0, 0, 0, 0, 0, 0, 10], // Saturday +10 (structural)
      leadtime: [
        { maxDays: 7, pct: -10 },
        { maxDays: 9999, pct: 0 },
      ],
    });
    const rates = computeRates(c, input());
    // Saturday Jul 11 is 5 days out: (40000 × 1.10) × 0.90 = 39600
    expect(rateOn(rates, "2026-07-11").price_cents).toBe(39600);
  });
});

describe("gap detection", () => {
  it("finds gaps bounded by occupied nights and respects max length", () => {
    const occupied = new Set([
      addDays(TODAY, 3),
      addDays(TODAY, 6), // 2-night gap at +4, +5
      addDays(TODAY, 12), // 5-night gap at +7..+11 (too long)
    ]);
    const gaps = findGapNights(input({ occupiedNights: occupied }), 2);
    expect(gaps.get(addDays(TODAY, 4))).toBe(2);
    expect(gaps.get(addDays(TODAY, 5))).toBe(2);
    expect(gaps.has(addDays(TODAY, 8))).toBe(false);
  });

  it("treats today as a left boundary (orphan before first booking)", () => {
    const occupied = new Set([addDays(TODAY, 1)]);
    const gaps = findGapNights(input({ occupiedNights: occupied }), 2);
    expect(gaps.get(TODAY)).toBe(1);
  });

  it("does not flag open runs with no booking on the right", () => {
    const gaps = findGapNights(input(), 2);
    expect(gaps.size).toBe(0);
  });

  it("sets min-stay to the gap length", () => {
    const occupied = new Set([addDays(TODAY, 3), addDays(TODAY, 5)]);
    const c = cfg({
      gap: { maxGapNights: 2, pct: -15, setMinStay: true },
      minStay: { base: 3, seasons: [], lastMinute: null },
    });
    const rates = computeRates(c, input({ occupiedNights: occupied }));
    expect(rateOn(rates, addDays(TODAY, 4)).min_stay).toBe(1);
    expect(rateOn(rates, addDays(TODAY, 7)).min_stay).toBe(3);
  });
});

describe("pace controller", () => {
  it("discounts under-booked windows and caps the adjustment", () => {
    const c = cfg({
      pace: { enabled: true, buckets: [{ days: 30, targetOcc: 0.6 }], maxPct: 15 },
    });
    // 0 of 30 nights booked, target 60% → raw (0−0.6)×100×0.5 = −30 → capped −15.
    const rates = computeRates(c, input());
    expect(rateOn(rates, addDays(TODAY, 10)).factors.pace_pct).toBe(-15);
    expect(rateOn(rates, addDays(TODAY, 10)).price_cents).toBe(34000);
  });

  it("premiums over-booked windows", () => {
    const occupied = new Set(Array.from({ length: 27 }, (_, i) => addDays(TODAY, i)));
    const c = cfg({
      pace: { enabled: true, buckets: [{ days: 30, targetOcc: 0.6 }], maxPct: 15 },
    });
    const rates = computeRates(c, input({ occupiedNights: occupied }));
    // 27/30 = 90% vs 60% target → +15 (raw exactly +15 at ×0.5)
    expect(rateOn(rates, addDays(TODAY, 28)).factors.pace_pct).toBe(15);
  });
});

describe("velocity (comp-set pickup premium)", () => {
  const tiers = [
    { minPickup: 0.4, pct: 15 },
    { minPickup: 0.25, pct: 10 },
    { minPickup: 0.15, pct: 5 },
  ];

  it("prices up dates with hot comp-set pickup, by tier", () => {
    const c = cfg({ velocity: { enabled: true, tiers, maxPct: 15 } });
    const velocityByDate = new Map([
      [addDays(TODAY, 5), 0.45], // ≥40% → +15
      [addDays(TODAY, 6), 0.3], // ≥25% → +10
      [addDays(TODAY, 7), 0.18], // ≥15% → +5
      [addDays(TODAY, 8), 0.05], // below all tiers → 0
    ]);
    const rates = computeRates(c, input({ velocityByDate }));
    expect(rateOn(rates, addDays(TODAY, 5)).price_cents).toBe(46000);
    expect(rateOn(rates, addDays(TODAY, 6)).price_cents).toBe(44000);
    expect(rateOn(rates, addDays(TODAY, 7)).price_cents).toBe(42000);
    expect(rateOn(rates, addDays(TODAY, 8)).price_cents).toBe(40000);
    expect(rateOn(rates, addDays(TODAY, 5)).factors.velocity_pct).toBe(15);
    expect(rateOn(rates, addDays(TODAY, 5)).factors.pickup_7d).toBe(0.45);
  });

  it("caps the premium at maxPct and is off when disabled", () => {
    const capped = computeRates(
      cfg({ velocity: { enabled: true, tiers: [{ minPickup: 0.2, pct: 40 }], maxPct: 12 } }),
      input({ velocityByDate: new Map([[addDays(TODAY, 3), 0.9]]) })
    );
    expect(rateOn(capped, addDays(TODAY, 3)).price_cents).toBe(44800); // +12, not +40

    const off = computeRates(
      cfg({ velocity: { enabled: false, tiers, maxPct: 15 } }),
      input({ velocityByDate: new Map([[addDays(TODAY, 3), 0.9]]) })
    );
    expect(rateOn(off, addDays(TODAY, 3)).price_cents).toBe(40000);
  });

  it("stacks with structural premiums and is not smoothed away", () => {
    const c = cfg({
      dowPct: [0, 0, 0, 0, 0, 0, 10], // Saturday +10 structural
      velocity: { enabled: true, tiers, maxPct: 15 },
      smoothingPct: 5,
    });
    // Saturday Jul 11 gets pickup 0.5 → structural 44000 × 1.15 = 50600
    const rates = computeRates(c, input({ velocityByDate: new Map([["2026-07-11", 0.5]]) }));
    expect(rateOn(rates, "2026-07-11").price_cents).toBe(50600);
    // neighbors unaffected (velocity is outside the smoothing pass)
    expect(rateOn(rates, "2026-07-10").price_cents).toBe(40000);
  });
});

describe("clamps, smoothing, overrides", () => {
  it("clamps to min and max", () => {
    const low = computeRates(
      cfg({ leadtime: [{ maxDays: 9999, pct: -80 }] }, { min_price_cents: 25000 }),
      input()
    );
    expect(rateOn(low, TODAY).price_cents).toBe(25000);
    expect(rateOn(low, TODAY).factors.clamped).toBe("min");

    const high = computeRates(
      cfg({ events: [{ from: TODAY, to: TODAY, pct: 400 }] }, { max_price_cents: 90000 }),
      input()
    );
    expect(rateOn(high, TODAY).price_cents).toBe(90000);
    expect(rateOn(high, TODAY).factors.clamped).toBe("max");
  });

  it("smooths lead-time cliffs but leaves structural jumps alone", () => {
    const c = cfg({
      leadtime: [
        { maxDays: 7, pct: -30 },
        { maxDays: 9999, pct: 0 },
      ],
      smoothingPct: 10,
    });
    const rates = computeRates(c, input());
    // Day 7 → −30, day 8 would jump to 0; smoothing caps it at −20, then −10, then 0.
    expect(rateOn(rates, addDays(TODAY, 8)).factors.smoothing_adj_pct).toBe(-20);
    expect(rateOn(rates, addDays(TODAY, 8)).price_cents).toBe(32000);
    expect(rateOn(rates, addDays(TODAY, 9)).price_cents).toBe(36000);
    expect(rateOn(rates, addDays(TODAY, 10)).price_cents).toBe(40000);
  });

  it("date overrides pierce the clamp and set min-stay", () => {
    const c = cfg({ overrides: [{ date: addDays(TODAY, 5), price_cents: 150000, min_stay: 4 }] });
    const rates = computeRates(c, input());
    const r = rateOn(rates, addDays(TODAY, 5));
    expect(r.price_cents).toBe(150000); // above max_price_cents
    expect(r.min_stay).toBe(4);
    expect(r.factors.override).toBe(true);
  });
});

describe("min-stay rules", () => {
  it("drops min-stay for last-minute dates", () => {
    const c = cfg({
      minStay: { base: 3, seasons: [], lastMinute: { withinDays: 7, value: 1 } },
    });
    const rates = computeRates(c, input());
    expect(rateOn(rates, addDays(TODAY, 3)).min_stay).toBe(1);
    expect(rateOn(rates, addDays(TODAY, 10)).min_stay).toBe(3);
  });

  it("applies seasonal min-stays", () => {
    const c = cfg({
      minStay: { base: 2, seasons: [{ from: "07-01", to: "08-31", value: 3 }], lastMinute: null },
    });
    const rates = computeRates(c, input({ horizonDays: 90 }));
    expect(rateOn(rates, "2026-07-20").min_stay).toBe(3);
    expect(rateOn(rates, "2026-09-15").min_stay).toBe(2);
  });
});

describe("output shape", () => {
  it("prices whole dollars, covers the horizon, marks occupied nights", () => {
    const occupied = new Set([addDays(TODAY, 2)]);
    const rates = computeRates(cfg(), input({ occupiedNights: occupied }));
    expect(rates).toHaveLength(30);
    expect(rates.every((r) => r.price_cents % 100 === 0)).toBe(true);
    expect(rateOn(rates, addDays(TODAY, 2)).factors.occupied).toBe(true);
  });
});
