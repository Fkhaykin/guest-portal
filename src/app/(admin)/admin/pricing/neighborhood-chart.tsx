"use client";

import { useMemo, useState } from "react";
import {
  Area,
  Bar,
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

// Future Prices & Occupancy — mirrors PriceLabs' Neighborhood Data:
//  • our nightly price (solid) + last-seen published price on Airbnb (dotted)
//  • market price percentile bands (25–50 / 50–75 / 75–90)
//  • event/holiday markers along the axis
//  • a paired occupancy chart: our booked nights (bars) + market occupancy (line)
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
      const p25 = m?.p25 != null ? Math.round(m.p25 / 100) : null;
      const p50 = m?.p50 != null ? Math.round(m.p50 / 100) : null;
      const p75 = m?.p75 != null ? Math.round(m.p75 / 100) : null;
      const p90 = m?.p90 != null ? Math.round(m.p90 / 100) : null;
      return {
        date: r.stay_date,
        ours: r.our_price_cents != null ? Math.round(r.our_price_cents / 100) : null,
        published: m?.published_cents != null ? Math.round(m.published_cents / 100) : null,
        band25: p25,
        band2550: p25 != null && p50 != null ? p50 - p25 : null,
        band5075: p50 != null && p75 != null ? p75 - p50 : null,
        band7590: p75 != null && p90 != null ? p90 - p75 : null,
        booked: r.is_booked ? 100 : 0,
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

  const hasBands = data.some((d) => d.band25 != null);
  const hasPublished = data.some((d) => d.published != null);
  const hasOcc = data.some((d) => d.occupancy != null);

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
                  if (value == null) return ["—", name as string];
                  if (name === "Our price" || name === "Published (Airbnb)") return ["$" + value, name];
                  return null as unknown as [string, string];
                }}
              />
              {/* event/holiday shaded bands */}
              {events.map((e, i) => (
                <ReferenceArea key={i} x1={e.from < data[0]?.date ? data[0]?.date : e.from} x2={e.to > lastDate ? lastDate : e.to} fill="var(--series-pl-rec)" fillOpacity={0.08} stroke="none" />
              ))}
              {/* percentile bands (transparent base + stacked deltas) */}
              <Area dataKey="band25" stackId="band" stroke="none" fill="transparent" isAnimationActive={false} legendType="none" />
              <Area dataKey="band2550" stackId="band" stroke="none" fill="var(--series-pl)" fillOpacity={0.26} isAnimationActive={false} name="Market 25–50th" />
              <Area dataKey="band5075" stackId="band" stroke="none" fill="var(--series-pl-rec)" fillOpacity={0.24} isAnimationActive={false} name="Market 50–75th" />
              <Area dataKey="band7590" stackId="band" stroke="none" fill="var(--series-pl-rec)" fillOpacity={0.12} isAnimationActive={false} name="Market 75–90th" />
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
            {!hasBands && <span>Market bands fill in as comp prices are scraped.</span>}
            {!hasPublished && <span>Published-price line appears once your own Airbnb listing is price-probed.</span>}
          </div>
        </CardContent>
      </Card>

      {hasOcc && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Occupancy</CardTitle>
            <p className="text-sm text-muted-foreground">Your booked nights against market occupancy.</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={fmtDate} minTickGap={48} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} stroke="var(--color-border)" />
                <YAxis tickFormatter={(v) => v + "%"} width={44} domain={[0, 100]} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} stroke="var(--color-border)" />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(l) => fmtDate(l as string)} formatter={(v, n) => [v == null ? "—" : (n === "Your nights" ? (v ? "Booked" : "Open") : v + "%"), n as string]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="booked" name="Your nights" fill="var(--series-ours)" fillOpacity={0.25} isAnimationActive={false} />
                <Line type="monotone" dataKey="occupancy" name="Market occupancy" stroke="var(--series-pl)" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
