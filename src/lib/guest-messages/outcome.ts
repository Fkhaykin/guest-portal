// Effectiveness tracking for AI-suggested replies. Given the AI draft and what
// the host actually sent (or that they discarded it), classify the outcome and
// measure how much changed — so we can watch the acceptance rate over time
// until drafts are good enough to send automatically.
//
// This is the metrics side of the feature; draft_feedback stays the training
// loop. Records land in the draft_outcome table via /api/admin/messages/outcome.

export type DraftOutcome = "accepted" | "edited" | "discarded";

/** Houses an outcome can be scoped to (nickname keys, matching draft_feedback). */
export const OUTCOME_HOUSES = ["lakehouse", "chalet", "manor", "cottage", "mansion"] as const;
export type OutcomeHouse = (typeof OUTCOME_HOUSES)[number];

/** An edited draft whose text changed by no more than this is "near-miss" — the
 * host barely touched it, so it counts toward the auto-ready trend. */
export const NEAR_MISS_PERCENT = 10;

/** Levenshtein distance is O(n·m); cap inputs so a pathological paste can't
 * stall the request. 8k chars comfortably covers any real reply. */
export const MAX_DIFF_CHARS = 8000;

/** Collapse whitespace runs so trivial spacing differences read as identical —
 * matches the messenger's own edit-detection (page.tsx handleSend). */
function normalize(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Levenshtein edit distance with a rolling two-row buffer (O(n·m) time,
 * O(min(n,m)) space). Inputs are capped by the caller. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  // Keep the shorter string on the inner axis to minimise the row width.
  if (a.length > b.length) [a, b] = [b, a];
  let prev = Array.from({ length: a.length + 1 }, (_, i) => i);
  let curr = new Array<number>(a.length + 1);
  for (let j = 1; j <= b.length; j++) {
    curr[0] = j;
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[i] = Math.min(prev[i] + 1, curr[i - 1] + 1, prev[i - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[a.length];
}

export interface DiffStats {
  /** "accepted" when nothing but whitespace changed, else "edited". */
  outcome: "accepted" | "edited";
  draftLength: number;
  sentLength: number;
  distance: number;
  /** distance / longer-length, as a 0–100 percentage (2 decimal places). */
  percentChanged: number;
}

/** Compare an AI draft against the finally-sent text. */
export function diffStats(draft: string, sent: string): DiffStats {
  const nd = normalize(draft).slice(0, MAX_DIFF_CHARS);
  const ns = normalize(sent).slice(0, MAX_DIFF_CHARS);
  if (nd === ns) {
    return { outcome: "accepted", draftLength: nd.length, sentLength: ns.length, distance: 0, percentChanged: 0 };
  }
  const distance = levenshtein(nd, ns);
  const denom = Math.max(nd.length, ns.length) || 1;
  const percentChanged = Math.round((distance / denom) * 10000) / 100; // 2dp
  return { outcome: "edited", draftLength: nd.length, sentLength: ns.length, distance, percentChanged };
}

// ─── Aggregation ─────────────────────────────────────────────

/** A stored outcome row (only the columns the summary needs). */
export interface OutcomeRow {
  outcome: DraftOutcome;
  percent_changed: number | null;
  house: string | null;
  created_at: string;
}

export interface OutcomeTotals {
  accepted: number;
  edited: number;
  discarded: number;
  /** accepted + edited (drafts that actually went out). */
  sent: number;
  /** All acted-on drafts, including discards. */
  total: number;
  /** accepted / total — the headline "sent as-is" rate (%). */
  acceptanceRate: number;
  /** accepted / sent — of what was sent, how much went unedited (%). */
  sentAcceptanceRate: number;
  /** (accepted + lightly-edited) / total — trend toward automation (%). */
  autoReadyRate: number;
}

export interface OutcomeDay {
  date: string; // YYYY-MM-DD (UTC)
  accepted: number;
  edited: number;
  discarded: number;
  total: number;
  acceptanceRate: number;
}

export interface OutcomeSummary {
  totals: OutcomeTotals;
  /** One entry per day that had activity, oldest first — the trend series. */
  daily: OutcomeDay[];
  /** Per-house acceptance, for spotting which homes draft best. */
  byHouse: Array<{ house: string; total: number; acceptanceRate: number }>;
  /** Median % changed among edited drafts (null when there were none). */
  medianEditPercent: number | null;
}

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10; // 1dp
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const m = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return Math.round(m * 100) / 100;
}

/** Roll a list of outcome rows into headline totals, a daily trend, per-house
 * rates, and the median edit size. Pure — the API route fetches rows and calls
 * this. */
export function summarizeOutcomes(rows: OutcomeRow[]): OutcomeSummary {
  let accepted = 0;
  let edited = 0;
  let discarded = 0;
  let nearMiss = 0; // accepted + lightly-edited
  const editPercents: number[] = [];
  const days = new Map<string, { accepted: number; edited: number; discarded: number }>();
  const houses = new Map<string, { accepted: number; total: number }>();

  for (const row of rows) {
    if (row.outcome === "accepted") accepted++;
    else if (row.outcome === "edited") edited++;
    else discarded++;

    if (row.outcome === "accepted") nearMiss++;
    else if (row.outcome === "edited") {
      const changed = row.percent_changed ?? 100;
      editPercents.push(changed);
      if (changed <= NEAR_MISS_PERCENT) nearMiss++;
    }

    const day = row.created_at.slice(0, 10);
    const d = days.get(day) ?? { accepted: 0, edited: 0, discarded: 0 };
    d[row.outcome]++;
    days.set(day, d);

    if (row.house) {
      const h = houses.get(row.house) ?? { accepted: 0, total: 0 };
      h.total++;
      if (row.outcome === "accepted") h.accepted++;
      houses.set(row.house, h);
    }
  }

  const sent = accepted + edited;
  const total = sent + discarded;

  const daily: OutcomeDay[] = [...days.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, d]) => {
      const dayTotal = d.accepted + d.edited + d.discarded;
      return {
        date,
        accepted: d.accepted,
        edited: d.edited,
        discarded: d.discarded,
        total: dayTotal,
        acceptanceRate: pct(d.accepted, dayTotal),
      };
    });

  const byHouse = [...houses.entries()]
    .map(([house, h]) => ({ house, total: h.total, acceptanceRate: pct(h.accepted, h.total) }))
    .sort((a, b) => b.total - a.total);

  return {
    totals: {
      accepted,
      edited,
      discarded,
      sent,
      total,
      acceptanceRate: pct(accepted, total),
      sentAcceptanceRate: pct(accepted, sent),
      autoReadyRate: pct(nearMiss, total),
    },
    daily,
    byHouse,
    medianEditPercent: median(editPercents),
  };
}
