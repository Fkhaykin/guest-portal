import { describe, it, expect } from "vitest";
import {
  levenshtein,
  diffStats,
  summarizeOutcomes,
  NEAR_MISS_PERCENT,
  type OutcomeRow,
} from "./outcome";

describe("levenshtein", () => {
  it("is 0 for identical strings", () => {
    expect(levenshtein("hello", "hello")).toBe(0);
  });
  it("handles empty inputs", () => {
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("abc", "")).toBe(3);
  });
  it("counts single-character edits", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
  });
  it("is symmetric regardless of argument order", () => {
    expect(levenshtein("longer string here", "short")).toBe(
      levenshtein("short", "longer string here")
    );
  });
});

describe("diffStats", () => {
  it("classifies identical text as accepted with 0% changed", () => {
    const s = diffStats("See you at 4 PM!", "See you at 4 PM!");
    expect(s.outcome).toBe("accepted");
    expect(s.distance).toBe(0);
    expect(s.percentChanged).toBe(0);
  });

  it("treats whitespace-only differences as accepted", () => {
    const s = diffStats("Hi there,\n\n  welcome!", "Hi there, welcome!");
    expect(s.outcome).toBe("accepted");
    expect(s.percentChanged).toBe(0);
  });

  it("classifies real edits and reports percent changed", () => {
    const s = diffStats("Check-in is at 4 PM.", "Check-in is at 3 PM sharp.");
    expect(s.outcome).toBe("edited");
    expect(s.distance).toBeGreaterThan(0);
    expect(s.percentChanged).toBeGreaterThan(0);
    expect(s.percentChanged).toBeLessThanOrEqual(100);
  });

  it("reports lengths from the normalized text", () => {
    const s = diffStats("one   two", "one two three");
    expect(s.draftLength).toBe("one two".length);
    expect(s.sentLength).toBe("one two three".length);
  });
});

describe("summarizeOutcomes", () => {
  function row(outcome: OutcomeRow["outcome"], opts: Partial<OutcomeRow> = {}): OutcomeRow {
    return {
      outcome,
      percent_changed: opts.percent_changed ?? (outcome === "edited" ? 50 : outcome === "accepted" ? 0 : null),
      house: opts.house ?? null,
      created_at: opts.created_at ?? "2026-07-10T12:00:00.000Z",
    };
  }

  it("returns zeroed totals for no rows", () => {
    const s = summarizeOutcomes([]);
    expect(s.totals.total).toBe(0);
    expect(s.totals.acceptanceRate).toBe(0);
    expect(s.daily).toEqual([]);
    expect(s.medianEditPercent).toBeNull();
  });

  it("computes acceptance, sent, and auto-ready rates", () => {
    const rows = [
      row("accepted"),
      row("accepted"),
      row("edited", { percent_changed: 5 }), // near-miss (<= threshold)
      row("edited", { percent_changed: 60 }), // heavy edit
      row("discarded"),
    ];
    const { totals } = summarizeOutcomes(rows);
    expect(totals.accepted).toBe(2);
    expect(totals.edited).toBe(2);
    expect(totals.discarded).toBe(1);
    expect(totals.sent).toBe(4);
    expect(totals.total).toBe(5);
    // 2 accepted / 5 total
    expect(totals.acceptanceRate).toBe(40);
    // 2 accepted / 4 sent
    expect(totals.sentAcceptanceRate).toBe(50);
    // 2 accepted + 1 near-miss edit / 5
    expect(totals.autoReadyRate).toBe(60);
  });

  it("uses the near-miss threshold boundary inclusively", () => {
    const rows = [row("edited", { percent_changed: NEAR_MISS_PERCENT })];
    // A boundary edit still counts toward auto-ready.
    expect(summarizeOutcomes(rows).totals.autoReadyRate).toBe(100);
  });

  it("groups by UTC day, oldest first", () => {
    const rows = [
      row("accepted", { created_at: "2026-07-11T09:00:00.000Z" }),
      row("edited", { created_at: "2026-07-10T23:00:00.000Z" }),
      row("accepted", { created_at: "2026-07-10T08:00:00.000Z" }),
    ];
    const { daily } = summarizeOutcomes(rows);
    expect(daily.map((d) => d.date)).toEqual(["2026-07-10", "2026-07-11"]);
    expect(daily[0].total).toBe(2);
    expect(daily[0].acceptanceRate).toBe(50);
    expect(daily[1].acceptanceRate).toBe(100);
  });

  it("reports median edit size and per-house rates", () => {
    const rows = [
      row("edited", { percent_changed: 10, house: "lakehouse" }),
      row("edited", { percent_changed: 30, house: "lakehouse" }),
      row("accepted", { house: "chalet" }),
    ];
    const s = summarizeOutcomes(rows);
    expect(s.medianEditPercent).toBe(20); // (10 + 30) / 2
    const lakehouse = s.byHouse.find((h) => h.house === "lakehouse");
    const chalet = s.byHouse.find((h) => h.house === "chalet");
    expect(lakehouse?.acceptanceRate).toBe(0);
    expect(chalet?.acceptanceRate).toBe(100);
  });
});
