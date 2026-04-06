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
import { Building2, Users, CreditCard, QrCode } from "lucide-react";

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

const TOOLTIP_STYLE = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "13px",
};

type AnalyticsData = {
  properties: { id: string; name: string }[];
  charts: {
    revenueOverTime: Record<string, unknown>[];
    occupancyByProperty: { property: string; occupancy: number }[];
    bookingsPerMonth: { month: string; bookings: number }[];
    avgStayByProperty: { property: string; avgNights: number }[];
    guestCountTrend: { month: string; guests: number }[];
    bookingSourceBreakdown: { name: string; value: number }[];
    revenueByProperty: { property: string; revenue: number }[];
  };
  stats: {
    totalRevenue: number;
    totalBookings: number;
    activeBookings: number;
    totalQrScans: number;
  };
};

function formatMonth(m: string) {
  const [year, month] = m.split("-");
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
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
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="h-3 w-24 bg-muted animate-pulse rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-7 w-20 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
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
      </div>
    );
  }

  if (!data || !data.charts) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          No analytics data available yet. Run a Lodgify sync to populate data.
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
    bookingSourceBreakdown,
    revenueByProperty,
  } = data.charts;

  const { stats } = data;
  const propertyNames = data.properties.map((p) => p.name);

  return (
    <div className="space-y-4">
      {/* Summary stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatDollars(stats.totalRevenue / 100)}
            </div>
            <p className="text-xs text-muted-foreground">From Lodgify bookings</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalBookings}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeBookings} currently active
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Properties</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.properties.length}</div>
            <p className="text-xs text-muted-foreground">Synced from Lodgify</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">QR Scans</CardTitle>
            <QrCode className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalQrScans.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Total across all codes</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 1. Revenue Over Time — full width */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue Over Time</CardTitle>
            <CardDescription>
              Monthly booking revenue by property (from Lodgify)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {revenueOverTime.length === 0 ? (
              <EmptyState label="No revenue data — run a Lodgify sync" />
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
                    contentStyle={TOOLTIP_STYLE}
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
                    contentStyle={TOOLTIP_STYLE}
                  />
                  <Bar dataKey="occupancy" radius={[6, 6, 0, 0]}>
                    {occupancyByProperty.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* 3. Revenue by Property */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Property</CardTitle>
            <CardDescription>Total booking revenue per property</CardDescription>
          </CardHeader>
          <CardContent>
            {revenueByProperty.length === 0 ? (
              <EmptyState />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={revenueByProperty}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="property" className="text-xs" />
                  <YAxis tickFormatter={formatDollars} className="text-xs" />
                  <Tooltip
                    formatter={((v: ValueType) => formatDollars(Number(v))) as never}
                    contentStyle={TOOLTIP_STYLE}
                  />
                  <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                    {revenueByProperty.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* 4. Bookings Per Month */}
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
                    contentStyle={TOOLTIP_STYLE}
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

        {/* 5. Average Stay Duration */}
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
                    contentStyle={TOOLTIP_STYLE}
                  />
                  <Bar dataKey="avgNights" radius={[0, 6, 6, 0]}>
                    {avgStayByProperty.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* 6. Guest Volume */}
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
                    contentStyle={TOOLTIP_STYLE}
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

        {/* 7. Booking Sources */}
        <Card>
          <CardHeader>
            <CardTitle>Booking Sources</CardTitle>
            <CardDescription>
              Where bookings come from (Airbnb, VRBO, etc.)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {bookingSourceBreakdown.length === 0 ? (
              <EmptyState label="No booking source data" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={bookingSourceBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {bookingSourceBreakdown.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
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
