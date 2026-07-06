import type { PricingRules, RateFactors } from "@/lib/pricing/engine";

export interface PricingConfig {
  id: string;
  nickname: string;
  mode: "off" | "shadow" | "live";
  base_price_cents: number;
  min_price_cents: number;
  max_price_cents: number;
  rules: PricingRules;
  hoa_type?: string | null;
}

// HOA code → display label for the pricing-lab house filter.
export const HOA_LABELS: Record<string, string> = {
  pepoa: "Penn Estates",
  bmlc: "Big Bass Lake",
};
export const hoaLabel = (t: string | null | undefined): string => (t ? HOA_LABELS[t] ?? t.toUpperCase() : "Other");

export interface SnapshotRow {
  stay_date: string;
  our_price_cents: number | null;
  our_min_stay: number | null;
  factors: RateFactors | null;
  pl_price_cents: number | null;
  pl_user_price_cents: number | null;
  pl_min_stay: number | null;
  is_booked: boolean;
}

export interface DivergencePoint {
  snapshot_date: string;
  mean_abs_pct: number;
  dates_compared: number;
}

export interface CompRow {
  id: string;
  airbnb_id: string;
  label: string | null;
  url: string | null;
  photo_url: string | null;
  is_self: boolean;
  is_active: boolean;
  last_scraped_at: string | null;
  last_priced_at: string | null;
  last_error: string | null;
  lat: number | null;
  lng: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  rating: number | null;
  review_count: number | null;
  is_lakefront: boolean;
  has_hot_tub: boolean | null;
  has_sauna: boolean | null;
  has_game_room: boolean | null;
  stats: {
    occupancy30: number | null;
    occupancy60: number | null;
    occupancy90: number | null;
    medianPriceCents: number | null;
    medianWeekendCents: number | null;
    medianWeeknightCents: number | null;
  };
}

export interface MarketPoint {
  stay_date: string;
  occupancy: number | null;
  compsCounted: number;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p90: number | null;
  pricesCounted: number;
  pickup_7d?: number | null;
  pickup_1d?: number | null;
  lf_occupancy?: number | null;
  lf_p50?: number | null;
  published_cents?: number | null;
}

export interface PositionWindow {
  days: number;
  ourOcc: number;
  marketOcc: number | null;
  lfOcc: number | null;
  ourAvgCents: number | null;
  marketAvgCents: number | null;
  lfAvgCents: number | null;
  nights: number;
}

export interface MarketPosition {
  windows: PositionWindow[];
  weekend: { ourAvgCents: number | null; marketAvgCents: number | null };
  weeknight: { ourAvgCents: number | null; marketAvgCents: number | null };
}

export interface HotDate {
  stay_date: string;
  pickup_7d: number;
  our_price_cents: number | null;
  velocity_pct: number;
  booked: boolean;
}

export interface BookingNight {
  adr_cents: number | null;
  is_check_in: boolean;
  source: string | null;
  check_in: string;
  check_out: string;
}
export interface BlockNight {
  reason: string | null;
}

export interface PricingLabData {
  config: PricingConfig;
  latest_snapshot_date: string | null;
  snapshot: SnapshotRow[];
  divergence: DivergencePoint[];
  comps: CompRow[];
  market: MarketPoint[];
  metrics: { occ7: number; occ30: number; occ60: number };
  position: MarketPosition;
  hotDates: HotDate[];
  bookings: Record<string, BookingNight>;
  blocks: Record<string, BlockNight>;
  house: { lat: number; lng: number } | null;
  today: string;
  meta: { name: string; address: string | null; maxGuests: number | null; lodgifyId: number | null } | null;
  latest_snapshot_at: string | null;
  pulse_date: string | null;
  realizedAdr: number | null;
  logs: ConfigLog[];
  notes: PricingNote[];
  pricingRuns: PricingRun[];
  weather: Record<string, WeatherPoint>;
}

export interface WeatherPoint {
  desirability: number;
  tempMaxF: number | null;
  precipProb: number | null;
  code: number | null;
  label: string;
  emoji: string;
}

export interface ConfigLog {
  id: number;
  field: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}
export interface PricingNote {
  id: string;
  body: string;
  created_at: string;
}
export interface PricingRun {
  snapshot_date: string;
  rows: number;
  pl_covered: number;
}

/** "3 hours ago" relative-time for sync/staleness labels. */
export function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/** Days between a YYYY-MM-DD date and today (UTC). */
export function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const then = new Date(dateStr + "T00:00:00Z").getTime();
  return Math.floor((Date.now() - then) / 86_400_000);
}

export const fmtUsd = (cents: number | null | undefined): string =>
  cents == null ? "—" : "$" + Math.round(cents / 100).toLocaleString();

export const fmtDate = (iso: string): string =>
  new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
