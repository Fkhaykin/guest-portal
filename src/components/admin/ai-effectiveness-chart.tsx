"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { OutcomeDay } from "@/lib/guest-messages/outcome";

const TOOLTIP_STYLE: React.CSSProperties = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: "8px",
  fontSize: "13px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
  padding: "8px 12px",
};

function shortDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** Daily acceptance-rate trend (line) over draft volume (faint bars). Lazy-loaded
 * via ai-effectiveness.tsx so recharts stays out of the initial bundle. */
export function AiEffectivenessChart({ data }: { data: OutcomeDay[] }) {
  const chartData = data.map((d) => ({ ...d, label: shortDate(d.date) }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
          <XAxis dataKey="label" className="text-xs" tickLine={false} axisLine={false} minTickGap={16} />
          <YAxis
            yAxisId="rate"
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            className="text-xs"
            tickLine={false}
            axisLine={false}
          />
          <YAxis yAxisId="vol" orientation="right" allowDecimals={false} className="text-xs" hide />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value, name) =>
              name === "Accepted as-is" ? [`${value}%`, name] : [value, name]
            }
          />
          <Bar
            yAxisId="vol"
            dataKey="total"
            name="Drafts"
            fill="hsl(220, 70%, 55%)"
            fillOpacity={0.14}
            radius={[3, 3, 0, 0]}
            maxBarSize={28}
          />
          <Line
            yAxisId="rate"
            type="monotone"
            dataKey="acceptanceRate"
            name="Accepted as-is"
            stroke="hsl(220, 70%, 55%)"
            strokeWidth={2.5}
            dot={{ r: 3 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
