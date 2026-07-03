import type { PricingRules, RateFactors } from "@/lib/pricing/engine";

export interface PricingConfig {
  id: string;
  nickname: string;
  mode: "off" | "shadow" | "live";
  base_price_cents: number;
  min_price_cents: number;
  max_price_cents: number;
  rules: PricingRules;
}

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
  is_self: boolean;
  is_active: boolean;
  last_scraped_at: string | null;
  last_error: string | null;
  lat: number | null;
  lng: number | null;
  bedrooms: number | null;
  rating: number | null;
  review_count: number | null;
  stats: { occupancy30: number | null; medianPriceCents: number | null };
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
}

export interface PricingLabData {
  config: PricingConfig;
  latest_snapshot_date: string | null;
  snapshot: SnapshotRow[];
  divergence: DivergencePoint[];
  comps: CompRow[];
  market: MarketPoint[];
  metrics: { occ7: number; occ30: number; occ60: number };
  house: { lat: number; lng: number } | null;
  today: string;
}

export const fmtUsd = (cents: number | null | undefined): string =>
  cents == null ? "—" : "$" + Math.round(cents / 100).toLocaleString();

export const fmtDate = (iso: string): string =>
  new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
