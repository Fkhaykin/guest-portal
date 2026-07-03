"use client";

import { useMemo } from "react";
import {
  Area,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SnapshotRow, MarketPoint } from "./types";
import { fmtDate } from "./types";

const TOOLTIP_STYLE: React.CSSProperties = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: "8px",
  fontSize: "13px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
  padding: "8px 12px",
};

// Future Prices & Occupancy — our nightly price over the market percentile
// bands (25–50 / 50–75 / 75–90), plus market occupancy. Mirrors PriceLabs'
// Neighborhood Data chart. Bands render from whatever comp prices have been
// probed; sparse coverage simply shows narrower/absent bands.
export function NeighborhoodChart({
  snapshot,
  market,
  days = 180,
}: {
  snapshot: SnapshotRow[];
  market: MarketPoint[];
  days?: number;
}) {
  const marketByDate = useMemo(() => new Map(market.map((m) => [m.stay_date, m])), [market]);

  const data = useMemo(() => {
    return snapshot.slice(0, days).map((r) => {
      const m = marketByDate.get(r.stay_date);
      const p25 = m?.p25 != null ? Math.round(m.p25 / 100) : null;
      const p50 = m?.p50 != null ? Math.round(m.p50 / 100) : null;
      const p75 = m?.p75 != null ? Math.round(m.p75 / 100) : null;
      const p90 = m?.p90 != null ? Math.round(m.p90 / 100) : null;
      return {
        date: r.stay_date,
        ours: r.our_price_cents != null ? Math.round(r.our_price_cents / 100) : null,
        // stacked areas: base (p25) transparent, then successive deltas
        band25: p25,
        band2550: p25 != null && p50 != null ? p50 - p25 : null,
        band5075: p50 != null && p75 != null ? p75 - p50 : null,
        band7590: p75 != null && p90 != null ? p90 - p75 : null,
        occupancy: m?.occupancy != null ? Math.round(m.occupancy * 100) : null,
      };
    });
  }, [snapshot, marketByDate, days]);

  const hasBands = data.some((d) => d.band25 != null);
  const hasOcc = data.some((d) => d.occupancy != null);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Future Prices &amp; Occupancy</CardTitle>
          <p className="text-sm text-muted-foreground">
            Our nightly price against the neighborhood price bands (25th–90th percentile of your
            comp set). {hasBands ? "" : "Bands fill in as comp prices are scraped."}
          </p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="date" tickFormatter={fmtDate} minTickGap={48} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} stroke="var(--color-border)" />
              <YAxis tickFormatter={(v) => "$" + v} width={52} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} stroke="var(--color-border)" />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelFormatter={(l) => fmtDate(l as string)}
                formatter={(value, name) => {
                  if (value == null) return ["—", name as string];
                  if (name === "Our price") return ["$" + value, name];
                  return null as unknown as [string, string];
                }}
              />
              {/* stacked percentile bands, from lightest (outer) to filled (inner) */}
              <Area dataKey="band25" stackId="band" stroke="none" fill="transparent" isAnimationActive={false} />
              <Area dataKey="band2550" stackId="band" stroke="none" fill="var(--series-pl)" fillOpacity={0.28} isAnimationActive={false} name="25–50th" />
              <Area dataKey="band5075" stackId="band" stroke="none" fill="var(--series-pl-rec)" fillOpacity={0.26} isAnimationActive={false} name="50–75th" />
              <Area dataKey="band7590" stackId="band" stroke="none" fill="var(--series-pl-rec)" fillOpacity={0.14} isAnimationActive={false} name="75–90th" />
              <Line type="monotone" dataKey="ours" name="Our price" stroke="var(--series-ours)" strokeWidth={2.5} dot={false} connectNulls isAnimationActive={false} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </ComposedChart>
          </ResponsiveContainer>
          {!hasBands && (
            <p className="mt-2 text-xs text-muted-foreground">
              No comp prices yet — add comps and let the daily scrape run, or the price probes are
              still accruing.
            </p>
          )}
        </CardContent>
      </Card>

      {hasOcc && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Market Occupancy</CardTitle>
            <p className="text-sm text-muted-foreground">
              Share of your comp set already booked, by stay date.
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={fmtDate} minTickGap={48} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} stroke="var(--color-border)" />
                <YAxis tickFormatter={(v) => v + "%"} width={44} domain={[0, 100]} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} stroke="var(--color-border)" />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(l) => fmtDate(l as string)} formatter={(v) => [v == null ? "—" : v + "%", "Market booked"]} />
                <Area type="monotone" dataKey="occupancy" name="Market booked" stroke="var(--series-ours)" fill="var(--series-ours)" fillOpacity={0.15} strokeWidth={2} connectNulls isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
