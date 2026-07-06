"use client";

import { useMemo } from "react";
import {
  Area,
  Bar,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Waves, SlidersHorizontal } from "lucide-react";
import type { PricingLabData } from "./types";
import { fmtUsd, fmtDate } from "./types";

const TOOLTIP_STYLE: React.CSSProperties = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: "8px",
  fontSize: "13px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
  padding: "8px 12px",
};

// How the algorithm reacts to the market: our position vs comps over 30/60/90
// days, weekend/weeknight averages, and the booking-velocity signal driving
// automatic price-ups on dates the market is booking fast.
export function AlgorithmTab({ data, lakefront }: { data: PricingLabData; lakefront: boolean }) {
  const { position, hotDates, market } = data;

  const velocityData = useMemo(() => {
    const byDate = new Map(data.snapshot.map((r) => [r.stay_date, r]));
    return market
      .filter((m) => m.pickup_7d != null)
      .slice(0, 120)
      .map((m) => {
        const row = byDate.get(m.stay_date);
        return {
          date: m.stay_date,
          pickup: m.pickup_7d != null ? Math.round(m.pickup_7d * 100) : null,
          occupancy: m.occupancy != null ? Math.round(m.occupancy * 100) : null,
          velocityPct: row?.factors?.velocity_pct ?? 0,
        };
      });
  }, [market, data.snapshot]);

  const hasVelocity = velocityData.some((d) => d.pickup != null);

  // Dynamic price factors over the near horizon: the adjustments the algorithm
  // layers on the seasonal base — lead-time (how far out), weather (near-term
  // forecast), booking velocity (comp-set pickup). Each is a signed % of price,
  // so they share one axis around a zero baseline.
  const factorData = useMemo(
    () =>
      data.snapshot.slice(0, 60).map((r) => ({
        date: r.stay_date,
        leadtime: r.factors?.leadtime_pct ?? 0,
        weather: r.factors?.weather_pct ?? 0,
        velocity: r.factors?.velocity_pct ?? 0,
      })),
    [data.snapshot]
  );
  const hasWeather = factorData.some((d) => d.weather !== 0);
  const hasVelocityPremium = factorData.some((d) => d.velocity !== 0);

  return (
    <div className="space-y-4">
      {/* Position vs market over 30/60/90 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Us vs the market</CardTitle>
          <p className="text-sm text-muted-foreground">
            Our occupancy and average nightly price against the comp set{lakefront ? " (with lakefront-only comps, since this house is lakefront)" : ""}.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            {position.windows.map((w) => (
              <div key={w.days} className="rounded-lg border border-border p-3">
                <div className="mb-2 text-sm font-semibold">Next {w.days} days</div>
                <StatLine label="Our occupancy" value={`${w.ourOcc}%`} />
                <StatLine label="Market occupancy" value={w.marketOcc != null ? `${w.marketOcc}%` : "—"} muted />
                {lakefront && w.lfOcc != null && <StatLine label="Lakefront occ." value={`${w.lfOcc}%`} muted />}
                <div className="my-2 border-t border-border" />
                <StatLine label={`Our avg price${w.nights ? ` (${w.nights}n)` : ""}`} value={fmtUsd(w.ourAvgCents)} accent="ours" />
                <StatLine label="Market median" value={fmtUsd(w.marketAvgCents)} accent="market" />
                {lakefront && w.lfAvgCents != null && <StatLine label="Lakefront median" value={fmtUsd(w.lfAvgCents)} muted />}
                {w.ourAvgCents != null && w.marketAvgCents != null && (
                  <div className="mt-2">
                    <PositionBadge ourCents={w.ourAvgCents} marketCents={w.marketAvgCents} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Dynamic price factors over time */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <SlidersHorizontal className="h-4 w-4" /> What&apos;s moving the price (next 60 days)
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            The adjustments layered on the seasonal base, each a ± percent of price. Lead-time discounts
            unsold near-term nights; weather nudges the ~16-day forecast window; booking velocity prices up
            dates the comp set is booking fast.
          </p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={factorData} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="date" tickFormatter={fmtDate} minTickGap={40} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} stroke="var(--color-border)" />
              <YAxis tickFormatter={(v) => (v > 0 ? "+" : "") + v + "%"} width={48} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} stroke="var(--color-border)" />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelFormatter={(l) => fmtDate(l as string)}
                formatter={(v, n) => [(Number(v) > 0 ? "+" : "") + v + "%", n as string]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine y={0} stroke="var(--color-border)" />
              <Line type="monotone" dataKey="leadtime" name="Lead-time" stroke="var(--series-ours)" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="weather" name="Weather" stroke="var(--series-pl-rec)" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="velocity" name="Booking velocity" stroke="var(--series-pl)" strokeWidth={2} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
            {!hasWeather && <span>Weather is flat here — it only moves nights inside the ~16-day forecast.</span>}
            {!hasVelocityPremium && <span>No velocity premium yet — the comp set isn&apos;t booking any near date fast enough to cross a tier.</span>}
          </div>
        </CardContent>
      </Card>

      {/* Weekend vs weeknight */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Weekend vs weeknight (next 90 days)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border p-3">
            <div className="mb-2 text-sm font-semibold">Weekend (Fri–Sat)</div>
            <StatLine label="Our avg" value={fmtUsd(position.weekend.ourAvgCents)} accent="ours" />
            <StatLine label="Market median" value={fmtUsd(position.weekend.marketAvgCents)} accent="market" />
          </div>
          <div className="rounded-lg border border-border p-3">
            <div className="mb-2 text-sm font-semibold">Weeknight (Sun–Thu)</div>
            <StatLine label="Our avg" value={fmtUsd(position.weeknight.ourAvgCents)} accent="ours" />
            <StatLine label="Market median" value={fmtUsd(position.weeknight.marketAvgCents)} accent="market" />
          </div>
        </CardContent>
      </Card>

      {/* Booking velocity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" /> Booking velocity
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            How fast the comp set is booking each date (7-day pickup). When pickup crosses a tier, the
            algorithm automatically prices that date up — the bars show the premium applied.
          </p>
        </CardHeader>
        <CardContent>
          {hasVelocity ? (
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={velocityData} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={fmtDate} minTickGap={40} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} stroke="var(--color-border)" />
                <YAxis yAxisId="pct" tickFormatter={(v) => v + "%"} width={44} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} stroke="var(--color-border)" />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelFormatter={(l) => fmtDate(l as string)}
                  formatter={(v, n) => [v == null ? "—" : v + "%", n as string]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area yAxisId="pct" type="monotone" dataKey="pickup" name="7-day pickup" stroke="var(--series-pl)" fill="var(--series-pl)" fillOpacity={0.15} strokeWidth={2} connectNulls isAnimationActive={false} />
                <Bar yAxisId="pct" dataKey="velocityPct" name="Our premium" fill="var(--series-ours)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Velocity needs at least two days of comp scrapes to measure pickup — it fills in over the
              next day or two.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Hot dates */}
      {hotDates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hot dates — pricing up now</CardTitle>
            <p className="text-sm text-muted-foreground">
              Highest comp-set pickup among your still-open dates.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {hotDates.map((d) => (
                <div key={d.stay_date} className="flex items-center gap-3 text-sm">
                  <span className="w-16 shrink-0 font-medium">{fmtDate(d.stay_date)}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full" style={{ width: `${Math.round(d.pickup_7d * 100)}%`, background: "var(--series-pl)" }} />
                  </div>
                  <span className="w-12 shrink-0 text-right text-xs text-muted-foreground">{Math.round(d.pickup_7d * 100)}%</span>
                  {d.velocity_pct > 0 && (
                    <Badge variant="secondary" className="shrink-0">+{d.velocity_pct}%</Badge>
                  )}
                  <span className="w-16 shrink-0 text-right font-medium" style={{ color: "var(--series-ours)" }}>
                    {fmtUsd(d.our_price_cents)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {lakefront && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Waves className="h-3.5 w-3.5" /> This house is lakefront — lakefront-only comp stats are shown where available.
        </p>
      )}
    </div>
  );
}

function StatLine({
  label,
  value,
  muted,
  accent,
}: {
  label: string;
  value: string;
  muted?: boolean;
  accent?: "ours" | "market";
}) {
  const color = accent === "ours" ? "var(--series-ours)" : accent === "market" ? "var(--series-pl)" : undefined;
  return (
    <div className="flex items-center justify-between py-0.5 text-sm">
      <span className={muted ? "text-xs text-muted-foreground" : "text-muted-foreground"}>{label}</span>
      <span className="font-semibold tabular-nums" style={color ? { color } : undefined}>
        {value}
      </span>
    </div>
  );
}

function PositionBadge({ ourCents, marketCents }: { ourCents: number; marketCents: number }) {
  const pct = Math.round(((ourCents - marketCents) / marketCents) * 100);
  if (Math.abs(pct) <= 3) return <Badge variant="secondary">at market</Badge>;
  return (
    <Badge variant="secondary" className={pct > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
      {pct > 0 ? "+" : ""}
      {pct}% vs market
    </Badge>
  );
}
