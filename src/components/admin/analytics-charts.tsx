"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { ValueType } from "recharts/types/component/DefaultTooltipContent";

const COLORS = [
  "hsl(220, 70%, 55%)",
  "hsl(160, 60%, 45%)",
  "hsl(30, 80%, 55%)",
  "hsl(340, 65%, 55%)",
  "hsl(270, 55%, 55%)",
  "hsl(190, 70%, 45%)",
  "hsl(50, 80%, 50%)",
  "hsl(0, 65%, 55%)",
];

type AnalyticsData = {
  properties: { id: string; name: string }[];
  charts: {
    revenueOverTime: Record<string, unknown>[];
    occupancyByProperty: { property: string; occupancy: number }[];
    bookingsPerMonth: { month: string; bookings: number }[];
    avgStayByProperty: { property: string; avgNights: number }[];
    guestCountTrend: { month: string; guests: number }[];
    upsellBreakdown: { name: string; value: number }[];
    qrScansData: { property: string; scans: number }[];
  };
};

function formatMonth(m: string) {
  const [year, month] = m.split("-");
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[parseInt(month) - 1]} ${year.slice(2)}`;
}

function formatDollars(v: number) {
  return `$${v.toLocaleString()}`;
}

export function AnalyticsCharts() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <Card key={i} className={i === 0 ? "lg:col-span-2" : ""}>
            <CardHeader>
              <div className="h-4 w-40 bg-muted animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-64 bg-muted/50 animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data || !data.charts) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          No analytics data available yet.
        </CardContent>
      </Card>
    );
  }

  const {
    revenueOverTime,
    occupancyByProperty,
    bookingsPerMonth,
    avgStayByProperty,
    guestCountTrend,
    upsellBreakdown,
    qrScansData,
  } = data.charts;

  const propertyNames = data.properties.map((p) => p.name);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* 1. Revenue Over Time — full width */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Revenue Over Time</CardTitle>
          <CardDescription>Monthly revenue by property</CardDescription>
        </CardHeader>
        <CardContent>
          {revenueOverTime.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={revenueOverTime}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="month"
                  tickFormatter={formatMonth}
                  className="text-xs"
                />
                <YAxis tickFormatter={formatDollars} className="text-xs" />
                <Tooltip
                  formatter={((v: ValueType) => formatDollars(Number(v))) as never}
                  labelFormatter={(label) => formatMonth(String(label))}
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "13px",
                  }}
                />
                <Legend />
                {propertyNames.map((name, i) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={COLORS[i % COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
                <Line
                  type="monotone"
                  dataKey="Total"
                  stroke="hsl(var(--foreground))"
                  strokeWidth={2.5}
                  strokeDasharray="6 3"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* 2. Occupancy % */}
      <Card>
        <CardHeader>
          <CardTitle>Occupancy Rate</CardTitle>
          <CardDescription>Last 12 months by property</CardDescription>
        </CardHeader>
        <CardContent>
          {occupancyByProperty.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={occupancyByProperty}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="property" className="text-xs" />
                <YAxis
                  tickFormatter={(v) => `${v}%`}
                  domain={[0, 100]}
                  className="text-xs"
                />
                <Tooltip
                  formatter={((v: ValueType) => `${v}%`) as never}
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "13px",
                  }}
                />
                <Bar dataKey="occupancy" radius={[6, 6, 0, 0]}>
                  {occupancyByProperty.map((_, i) => (
                    <Cell
                      key={i}
                      fill={COLORS[i % COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* 3. Bookings Per Month */}
      <Card>
        <CardHeader>
          <CardTitle>Bookings Per Month</CardTitle>
          <CardDescription>Total bookings trend</CardDescription>
        </CardHeader>
        <CardContent>
          {bookingsPerMonth.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={bookingsPerMonth}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="month"
                  tickFormatter={formatMonth}
                  className="text-xs"
                />
                <YAxis allowDecimals={false} className="text-xs" />
                <Tooltip
                  labelFormatter={(label) => formatMonth(String(label))}
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "13px",
                  }}
                />
                <Bar
                  dataKey="bookings"
                  fill="hsl(220, 70%, 55%)"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* 4. Average Stay Duration */}
      <Card>
        <CardHeader>
          <CardTitle>Average Stay Duration</CardTitle>
          <CardDescription>Nights per booking by property</CardDescription>
        </CardHeader>
        <CardContent>
          {avgStayByProperty.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={avgStayByProperty} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" className="text-xs" />
                <YAxis
                  dataKey="property"
                  type="category"
                  width={120}
                  className="text-xs"
                />
                <Tooltip
                  formatter={((v: ValueType) => `${v} nights`) as never}
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "13px",
                  }}
                />
                <Bar dataKey="avgNights" radius={[0, 6, 6, 0]}>
                  {avgStayByProperty.map((_, i) => (
                    <Cell
                      key={i}
                      fill={COLORS[i % COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* 5. Guest Count Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Guest Volume</CardTitle>
          <CardDescription>Total guests per month</CardDescription>
        </CardHeader>
        <CardContent>
          {guestCountTrend.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={guestCountTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="month"
                  tickFormatter={formatMonth}
                  className="text-xs"
                />
                <YAxis allowDecimals={false} className="text-xs" />
                <Tooltip
                  labelFormatter={(label) => formatMonth(String(label))}
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "13px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="guests"
                  stroke="hsl(160, 60%, 45%)"
                  fill="hsl(160, 60%, 45%)"
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* 6. Upsell Revenue Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Upsell Revenue</CardTitle>
          <CardDescription>Revenue by upsell type</CardDescription>
        </CardHeader>
        <CardContent>
          {upsellBreakdown.length === 0 ? (
            <EmptyState label="No upsell data yet" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={upsellBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, value }) => `${name}: $${value}`}
                >
                  {upsellBreakdown.map((_, i) => (
                    <Cell
                      key={i}
                      fill={COLORS[i % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={((v: ValueType) => formatDollars(Number(v))) as never}
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "13px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* 7. QR Scans by Property */}
      <Card>
        <CardHeader>
          <CardTitle>QR Code Engagement</CardTitle>
          <CardDescription>Total scans by property</CardDescription>
        </CardHeader>
        <CardContent>
          {qrScansData.length === 0 ? (
            <EmptyState label="No QR scan data yet" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={qrScansData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="property" className="text-xs" />
                <YAxis allowDecimals={false} className="text-xs" />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "13px",
                  }}
                />
                <Bar dataKey="scans" radius={[6, 6, 0, 0]}>
                  {qrScansData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={COLORS[i % COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyState({ label = "No data available" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
      {label}
    </div>
  );
}
