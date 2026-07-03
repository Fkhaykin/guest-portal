"use client";

import { useMemo } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import type { SnapshotRow } from "./types";
import { fmtUsd, fmtDate } from "./types";

const SERIES = {
  ours: "var(--series-ours)",
  pl: "var(--series-pl)",
  plRec: "var(--series-pl-rec)",
};

const TOOLTIP_STYLE: React.CSSProperties = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: "8px",
  fontSize: "13px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
  padding: "8px 12px",
};

export function ComparisonChart({ snapshot, days = 120 }: { snapshot: SnapshotRow[]; days?: number }) {
  const data = useMemo(() => {
    return snapshot
      .filter((r) => !r.is_booked)
      .slice(0, days)
      .map((r) => ({
        date: r.stay_date,
        Ours: r.our_price_cents != null ? Math.round(r.our_price_cents / 100) : null,
        "PriceLabs (pushed)": r.pl_user_price_cents != null ? Math.round(r.pl_user_price_cents / 100) : null,
        "PriceLabs (rec.)": r.pl_price_cents != null ? Math.round(r.pl_price_cents / 100) : null,
      }));
  }, [snapshot, days]);

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        No snapshot yet — run one to compare.
      </div>
    );
  }

  const hasPl = data.some((d) => d["PriceLabs (pushed)"] != null || d["PriceLabs (rec.)"] != null);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={fmtDate}
          minTickGap={40}
          tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
          stroke="var(--color-border)"
        />
        <YAxis
          tickFormatter={(v) => "$" + v}
          width={52}
          tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
          stroke="var(--color-border)"
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelFormatter={(l) => fmtDate(l as string)}
          formatter={(value, name) => [value == null ? "—" : "$" + value, name as string]}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line
          type="monotone"
          dataKey="Ours"
          stroke={SERIES.ours}
          strokeWidth={2.5}
          dot={false}
          connectNulls
        />
        {hasPl && (
          <Line
            type="monotone"
            dataKey="PriceLabs (pushed)"
            stroke={SERIES.pl}
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        )}
        {hasPl && (
          <Line
            type="monotone"
            dataKey="PriceLabs (rec.)"
            stroke={SERIES.plRec}
            strokeWidth={1.5}
            strokeDasharray="5 3"
            dot={false}
            connectNulls
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Small multiples of the day-over-day divergence trend. */
export function summarizeSnapshot(snapshot: SnapshotRow[]) {
  const comparable = snapshot.filter(
    (r) => !r.is_booked && r.our_price_cents != null && r.pl_user_price_cents != null
  );
  if (comparable.length === 0) {
    return { count: 0, meanAbsPct: null, ourMean: null, plMean: null, richerPct: null };
  }
  let sumAbs = 0;
  let ourSum = 0;
  let plSum = 0;
  let ourRicher = 0;
  for (const r of comparable) {
    const ours = r.our_price_cents!;
    const pl = r.pl_user_price_cents!;
    sumAbs += Math.abs(ours - pl) / pl;
    ourSum += ours;
    plSum += pl;
    if (ours > pl) ourRicher++;
  }
  const n = comparable.length;
  return {
    count: n,
    meanAbsPct: Math.round((sumAbs / n) * 1000) / 10,
    ourMean: Math.round(ourSum / n),
    plMean: Math.round(plSum / n),
    richerPct: Math.round((ourRicher / n) * 100),
  };
}

export { fmtUsd };
