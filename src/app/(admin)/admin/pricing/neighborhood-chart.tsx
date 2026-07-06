"use client";

import { useMemo, useState } from "react";
import {
  Area,
  ComposedChart,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PricingConfig, SnapshotRow, MarketPoint } from "./types";
import { fmtDate } from "./types";

const TOOLTIP_STYLE: React.CSSProperties = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: "8px",
  fontSize: "13px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
  padding: "8px 12px",
};

const HORIZONS = [60, 90, 180, 365];

// A percentile needs a real sample behind it. Below MEDIAN_MIN we draw nothing;
// at/above it we draw the market median line; the interquartile band only fills
// once BAND_MIN comps have priced the night — otherwise a 2-comp "band" invents
// a spread that isn't there.
const MEDIAN_MIN_COMPS = 3;
const BAND_MIN_COMPS = 6;

// Future Prices & Occupancy — our price against the neighborhood:
//  • our nightly price (solid) + last-seen published price on Airbnb (dotted)
//  • the market's interquartile range (p25–p75 band) + median (p50 line),
//    each gated on how many comps actually priced the night
//  • event/holiday markers along the axis
//  • a paired occupancy chart: market occupancy (line) + our booked-night rug
export function NeighborhoodChart({
  config,
  snapshot,
  market,
}: {
  config: PricingConfig;
  snapshot: SnapshotRow[];
  market: MarketPoint[];
}) {
  const [horizon, setHorizon] = useState(180);
  const marketByDate = useMemo(() => new Map(market.map((m) => [m.stay_date, m])), [market]);

  const data = useMemo(() => {
    return snapshot.slice(0, horizon).map((r) => {
      const m = marketByDate.get(r.stay_date);
      const n = m?.pricesCounted ?? 0;
      const p25 = n >= BAND_MIN_COMPS && m?.p25 != null ? Math.round(m.p25 / 100) : null;
      const p75 = n >= BAND_MIN_COMPS && m?.p75 != null ? Math.round(m.p75 / 100) : null;
      const p50 = n >= MEDIAN_MIN_COMPS && m?.p50 != null ? Math.round(m.p50 / 100) : null;
      return {
        date: r.stay_date,
        ours: r.our_price_cents != null ? Math.round(r.our_price_cents / 100) : null,
        published: m?.published_cents != null ? Math.round(m.published_cents / 100) : null,
        // Interquartile band as a transparent base (p25) + filled delta (p75−p25).
        iqrBase: p25,
        iqrBand: p25 != null && p75 != null ? p75 - p25 : null,
        marketMedian: p50,
        pricesCounted: n,
        booked: r.is_booked,
        occupancy: m?.occupancy != null ? Math.round(m.occupancy * 100) : null,
      };
    });
  }, [snapshot, marketByDate, horizon]);

  const lastDate = data.length ? data[data.length - 1].date : "";
  const events = useMemo(
    () =>
      (config.rules.events ?? []).filter(
        (e) => data.length > 0 && e.to >= data[0].date && e.from <= lastDate
      ),
    [config.rules.events, data, lastDate]
  );

  const hasBand = data.some((d) => d.iqrBand != null);
  const hasMedian = data.some((d) => d.marketMedian != null);
  const hasPublished = data.some((d) => d.published != null);
  const hasOcc = data.some((d) => d.occupancy != null);
  const bookedDates = useMemo(() => data.filter((d) => d.booked).map((d) => d.date), [data]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Future Prices &amp; Occupancy</CardTitle>
              <p className="text-sm text-muted-foreground">
                Our price and the price live on Airbnb, against the neighborhood price bands.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex overflow-hidden rounded-md border border-border">
                {HORIZONS.map((h) => (
                  <button
                    key={h}
                    onClick={() => setHorizon(h)}
                    className={`px-2.5 py-1 text-xs ${horizon === h ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                  >
                    {h}d
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={340}>
            <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="date" tickFormatter={fmtDate} minTickGap={48} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} stroke="var(--color-border)" />
              <YAxis tickFormatter={(v) => "$" + v} width={52} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} stroke="var(--color-border)" />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelFormatter={(l) => fmtDate(l as string)}
                formatter={(value, name) => {
                  if (value == null) return null as unknown as [string, string];
                  if (name === "Our price" || name === "Published (Airbnb)" || name === "Market median")
                    return ["$" + value, name];
                  return null as unknown as [string, string];
                }}
              />
              {/* event/holiday shaded bands */}
              {events.map((e, i) => (
                <ReferenceArea key={i} x1={e.from < data[0]?.date ? data[0]?.date : e.from} x2={e.to > lastDate ? lastDate : e.to} fill="var(--series-pl-rec)" fillOpacity={0.08} stroke="none" />
              ))}
              {/* Market interquartile range: transparent base at p25 + filled delta to p75 */}
              {hasBand && (
                <>
                  <Area dataKey="iqrBase" stackId="band" stroke="none" fill="transparent" isAnimationActive={false} legendType="none" connectNulls={false} />
                  <Area dataKey="iqrBand" stackId="band" stroke="none" fill="var(--series-pl)" fillOpacity={0.18} isAnimationActive={false} name="Market 25–75th" connectNulls={false} />
                </>
              )}
              {hasMedian && (
                <Line type="monotone" dataKey="marketMedian" name="Market median" stroke="var(--series-pl)" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
              )}
              {hasPublished && (
                <Line type="monotone" dataKey="published" name="Published (Airbnb)" stroke="var(--color-muted-foreground)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls isAnimationActive={false} />
              )}
              <Line type="monotone" dataKey="ours" name="Our price" stroke="var(--series-ours)" strokeWidth={2.5} dot={false} connectNulls isAnimationActive={false} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
            {events.length > 0 && (
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded-sm" style={{ background: "var(--series-pl-rec)", opacity: 0.25 }} /> Events &amp; holidays
              </span>
            )}
            {!hasMedian && <span>Market price line fills in as comp prices are scraped.</span>}
            {hasMedian && !hasBand && <span>The 25–75th band appears once ≥{BAND_MIN_COMPS} comps have priced a night.</span>}
            {!hasPublished && <span>Published-price line appears once your own Airbnb listing is price-probed.</span>}
          </div>
        </CardContent>
      </Card>

      {hasOcc && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Occupancy</CardTitle>
            <p className="text-sm text-muted-foreground">Market occupancy across the comp set, with your booked nights marked.</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={fmtDate} minTickGap={48} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} stroke="var(--color-border)" />
                <YAxis tickFormatter={(v) => v + "%"} width={44} domain={[0, 100]} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} stroke="var(--color-border)" />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(l) => fmtDate(l as string)} formatter={(v, n) => (n === "Market occupancy" && v != null ? [v + "%", n as string] : (null as unknown as [string, string]))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {/* Your booked nights: vertical markers, not a value on the % axis */}
                {bookedDates.map((d) => (
                  <ReferenceArea key={d} x1={d} x2={d} fill="var(--series-ours)" fillOpacity={0.5} stroke="none" ifOverflow="extendDomain" />
                ))}
                <Area type="monotone" dataKey="occupancy" name="Market occupancy" stroke="var(--series-pl)" fill="var(--series-pl)" fillOpacity={0.12} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
            {bookedDates.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-3 w-1.5 rounded-sm" style={{ background: "var(--series-ours)", opacity: 0.5 }} /> Your booked nights
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
