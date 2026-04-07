"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Building2,
  CreditCard,
  QrCode,
  CalendarRange,
} from "lucide-react";

// ─── Constants ───────────────────────────────────────────────

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

type GroupBy = "week" | "month" | "quarter";

type DatePreset = "30d" | "90d" | "6m" | "1y" | "all" | "custom";

const PRESETS: { value: DatePreset; label: string }[] = [
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "6m", label: "6 months" },
  { value: "1y", label: "1 year" },
  { value: "all", label: "All time" },
  { value: "custom", label: "Custom" },
];

// ─── Types ───────────────────────────────────────────────────

type Registration = {
  id: string;
  propertyId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  status: string;
  source: string | null;
  amount: number;
  createdAt: string;
};

type ApiData = {
  properties: { id: string; name: string }[];
  registrations: Registration[];
  qrScans: number;
};

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Parse a YYYY-MM-DD date string into local-time midnight.
 * Using `new Date("2026-02-15")` parses as UTC, which shifts the day
 * backward in western timezones — this avoids that.
 */
function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Today at midnight local time */
function today(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

function formatDollars(v: number) {
  return `$${v.toLocaleString()}`;
}

function getPresetRange(preset: DatePreset): [Date | null, Date | null] {
  if (preset === "all" || preset === "custom") return [null, null];
  const now = today();
  const from = new Date(now);
  if (preset === "30d") from.setDate(from.getDate() - 30);
  else if (preset === "90d") from.setDate(from.getDate() - 90);
  else if (preset === "6m") from.setMonth(from.getMonth() - 6);
  else if (preset === "1y") from.setFullYear(from.getFullYear() - 1);
  return [from, now];
}

function toBucketKey(dateStr: string, groupBy: GroupBy): string {
  // Parse directly from string to avoid timezone issues
  const [y, m, d] = dateStr.split("-").map(Number);
  if (groupBy === "week") {
    const date = new Date(y, m - 1, d);
    const dow = date.getDay(); // 0=Sun
    date.setDate(date.getDate() - ((dow + 6) % 7)); // floor to Monday
    const wy = date.getFullYear();
    const wm = String(date.getMonth() + 1).padStart(2, "0");
    const wd = String(date.getDate()).padStart(2, "0");
    return `${wy}-${wm}-${wd}`;
  }
  if (groupBy === "quarter") {
    const q = Math.floor((m - 1) / 3) + 1;
    return `${y}-Q${q}`;
  }
  // month
  return `${y}-${String(m).padStart(2, "0")}`;
}

function formatBucketLabel(key: string, groupBy: GroupBy): string {
  if (groupBy === "week") {
    const [y, m, d] = key.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  if (groupBy === "quarter") return key; // "2025-Q1"
  // month
  const MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const [yr, mo] = key.split("-");
  return `${MONTHS[parseInt(mo) - 1]} ${yr.slice(2)}`;
}

// ─── Component ───────────────────────────────────────────────

export function AnalyticsCharts() {
  const [raw, setRaw] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [preset, setPreset] = useState<DatePreset>("1y");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>("month");

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then((r) => r.json())
      .then((d) => {
        setRaw(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Compute effective date range
  const [rangeFrom, rangeTo] = useMemo(() => {
    if (preset === "custom") {
      return [
        customFrom ? parseDate(customFrom) : null,
        customTo ? parseDate(customTo) : null,
      ];
    }
    return getPresetRange(preset);
  }, [preset, customFrom, customTo]);

  // Filter registrations by date range
  const regs = useMemo(() => {
    if (!raw) return [];
    return raw.registrations.filter((r) => {
      if (r.status === "cancelled") return false;
      const d = parseDate(r.checkIn);
      if (rangeFrom && d < rangeFrom) return false;
      if (rangeTo && d > rangeTo) return false;
      return true;
    });
  }, [raw, rangeFrom, rangeTo]);

  // Derive all charts from filtered data
  const charts = useMemo(() => {
    if (!raw) return null;
    const properties = raw.properties;
    const propNameMap: Record<string, string> = {};
    for (const p of properties) propNameMap[p.id] = p.name;

    // 1. Revenue over time by property
    const revBuckets: Record<string, Record<string, number>> = {};
    for (const r of regs) {
      if (!r.amount) continue;
      const key = toBucketKey(r.checkIn, groupBy);
      if (!revBuckets[key]) revBuckets[key] = {};
      revBuckets[key][r.propertyId] =
        (revBuckets[key][r.propertyId] ?? 0) + r.amount;
    }
    const revKeys = Object.keys(revBuckets).sort();
    const revenueOverTime = revKeys.map((key) => {
      const entry: Record<string, unknown> = { bucket: key };
      let total = 0;
      for (const p of properties) {
        const val = (revBuckets[key]?.[p.id] ?? 0) / 100;
        entry[propNameMap[p.id]] = val;
        total += val;
      }
      entry["Total"] = total;
      return entry;
    });

    // 2. Occupancy %
    const from = rangeFrom ?? new Date(2020, 0, 1);
    const to = rangeTo ?? today();
    const totalDays = Math.max(
      1,
      Math.floor((to.getTime() - from.getTime()) / 86400000)
    );
    const occupancyByProperty = properties.map((p) => {
      const propRegs = regs.filter((r) => r.propertyId === p.id);
      let days = 0;
      for (const r of propRegs) {
        const ci = parseDate(r.checkIn);
        const co = parseDate(r.checkOut);
        const s = ci > from ? ci : from;
        const e = co < to ? co : to;
        days += Math.max(0, Math.floor((e.getTime() - s.getTime()) / 86400000));
      }
      return {
        property: propNameMap[p.id],
        occupancy: Math.round((days / totalDays) * 100),
      };
    });

    // 3. Revenue by property
    const revenueByProperty = properties.map((p) => {
      const total = regs
        .filter((r) => r.propertyId === p.id)
        .reduce((s, r) => s + r.amount, 0);
      return { property: propNameMap[p.id], revenue: total / 100 };
    });

    // 4. Bookings per period
    const bookBuckets: Record<string, number> = {};
    for (const r of regs) {
      const key = toBucketKey(r.checkIn, groupBy);
      bookBuckets[key] = (bookBuckets[key] ?? 0) + 1;
    }
    const bookKeys = Object.keys(bookBuckets).sort();
    const bookingsPerPeriod = bookKeys.map((key) => ({
      bucket: key,
      bookings: bookBuckets[key],
    }));

    // 5. Avg stay duration by property
    const avgStayByProperty = properties.map((p) => {
      const propRegs = regs.filter((r) => r.propertyId === p.id);
      if (!propRegs.length) return { property: propNameMap[p.id], avgNights: 0 };
      const nights = propRegs.reduce((s, r) => {
        return (
          s +
          Math.max(
            1,
            Math.floor(
              (parseDate(r.checkOut).getTime() - parseDate(r.checkIn).getTime()) /
                86400000
            )
          )
        );
      }, 0);
      return {
        property: propNameMap[p.id],
        avgNights: Math.round((nights / propRegs.length) * 10) / 10,
      };
    });

    // 6. Guest volume per period
    const guestBuckets: Record<string, number> = {};
    for (const r of regs) {
      const key = toBucketKey(r.checkIn, groupBy);
      guestBuckets[key] = (guestBuckets[key] ?? 0) + r.guests;
    }
    const guestKeys = Object.keys(guestBuckets).sort();
    const guestVolume = guestKeys.map((key) => ({
      bucket: key,
      guests: guestBuckets[key],
    }));

    // 7. Booking sources
    const srcCount: Record<string, number> = {};
    for (const r of regs) {
      const src = r.source || "Direct";
      srcCount[src] = (srcCount[src] ?? 0) + 1;
    }
    const sourceBreakdown = Object.entries(srcCount).map(([name, value]) => ({
      name,
      value,
    }));

    // Stats
    const totalRevenue = regs.reduce((s, r) => s + r.amount, 0);
    const activeCount = regs.filter((r) => r.status === "active").length;

    return {
      revenueOverTime,
      occupancyByProperty,
      revenueByProperty,
      bookingsPerPeriod,
      avgStayByProperty,
      guestVolume,
      sourceBreakdown,
      stats: {
        totalRevenue,
        totalBookings: regs.length,
        activeBookings: activeCount,
      },
    };
  }, [raw, regs, groupBy, rangeFrom, rangeTo]);

  // ─── Render ──────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-9 w-96 bg-muted animate-pulse rounded" />
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

  if (!raw || !charts) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          No analytics data available yet. Run a Lodgify sync to populate data.
        </CardContent>
      </Card>
    );
  }

  const propertyNames = raw.properties.map((p) => p.name);
  const { stats } = charts;
  const groupLabel =
    groupBy === "week" ? "Weekly" : groupBy === "quarter" ? "Quarterly" : "Monthly";

  return (
    <div className="space-y-4">
      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-3">
        <CalendarRange className="h-4 w-4 text-muted-foreground" />

        <div className="flex items-center gap-1">
          {PRESETS.map((p) => (
            <Button
              key={p.value}
              variant={preset === p.value ? "default" : "outline"}
              size="sm"
              onClick={() => setPreset(p.value)}
              className="h-7 text-xs px-2.5"
            >
              {p.label}
            </Button>
          ))}
        </div>

        {preset === "custom" && (
          <div className="flex items-center gap-1.5">
            <Input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-7 w-36 text-xs"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-7 w-36 text-xs"
            />
          </div>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Group by</span>
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
            <SelectTrigger size="sm" className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="month">Month</SelectItem>
              <SelectItem value="quarter">Quarter</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatDollars(stats.totalRevenue / 100)}
            </div>
            <p className="text-xs text-muted-foreground">In selected range</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Bookings</CardTitle>
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
            <div className="text-2xl font-bold">{raw.properties.length}</div>
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
              {raw.qrScans.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Total across all codes</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 1. Revenue Over Time */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue Over Time</CardTitle>
            <CardDescription>
              {groupLabel} booking revenue by property
            </CardDescription>
          </CardHeader>
          <CardContent>
            {charts.revenueOverTime.length === 0 ? (
              <EmptyState label="No revenue data in this range" />
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={charts.revenueOverTime}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="bucket"
                    tickFormatter={(v) => formatBucketLabel(v, groupBy)}
                    className="text-xs"
                  />
                  <YAxis tickFormatter={formatDollars} className="text-xs" />
                  <Tooltip
                    content={
                      <RevenueTooltip
                        groupBy={groupBy}
                        propertyNames={propertyNames}
                      />
                    }
                    wrapperStyle={{ zIndex: 10 }}
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
            <CardDescription>In selected date range</CardDescription>
          </CardHeader>
          <CardContent>
            {charts.occupancyByProperty.length === 0 ? (
              <EmptyState />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={charts.occupancyByProperty}>
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
                    {charts.occupancyByProperty.map((_, i) => (
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
            <CardDescription>Total in selected range</CardDescription>
          </CardHeader>
          <CardContent>
            {charts.revenueByProperty.length === 0 ? (
              <EmptyState />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={charts.revenueByProperty}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="property" className="text-xs" />
                  <YAxis tickFormatter={formatDollars} className="text-xs" />
                  <Tooltip
                    formatter={((v: ValueType) => formatDollars(Number(v))) as never}
                    contentStyle={TOOLTIP_STYLE}
                  />
                  <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                    {charts.revenueByProperty.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* 4. Bookings Per Period */}
        <Card>
          <CardHeader>
            <CardTitle>Bookings Per {groupBy === "week" ? "Week" : groupBy === "quarter" ? "Quarter" : "Month"}</CardTitle>
            <CardDescription>Total bookings trend</CardDescription>
          </CardHeader>
          <CardContent>
            {charts.bookingsPerPeriod.length === 0 ? (
              <EmptyState />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={charts.bookingsPerPeriod}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="bucket"
                    tickFormatter={(v) => formatBucketLabel(v, groupBy)}
                    className="text-xs"
                  />
                  <YAxis allowDecimals={false} className="text-xs" />
                  <Tooltip
                    labelFormatter={(l) => formatBucketLabel(String(l), groupBy)}
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
            {charts.avgStayByProperty.length === 0 ? (
              <EmptyState />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={charts.avgStayByProperty} layout="vertical">
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
                    {charts.avgStayByProperty.map((_, i) => (
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
            <CardDescription>{groupLabel} total guests</CardDescription>
          </CardHeader>
          <CardContent>
            {charts.guestVolume.length === 0 ? (
              <EmptyState />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={charts.guestVolume}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="bucket"
                    tickFormatter={(v) => formatBucketLabel(v, groupBy)}
                    className="text-xs"
                  />
                  <YAxis allowDecimals={false} className="text-xs" />
                  <Tooltip
                    labelFormatter={(l) => formatBucketLabel(String(l), groupBy)}
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
            {charts.sourceBreakdown.length === 0 ? (
              <EmptyState label="No booking source data" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={charts.sourceBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {charts.sourceBreakdown.map((_, i) => (
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

function RevenueTooltip({
  active,
  payload,
  label,
  groupBy: gb,
  propertyNames: names,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string }>;
  label?: string;
  groupBy: GroupBy;
  propertyNames: string[];
}) {
  if (!active || !payload?.length) return null;

  // Sort: properties first (in original order), Total always last
  const sorted = [...payload].sort((a, b) => {
    if (a.dataKey === "Total") return 1;
    if (b.dataKey === "Total") return -1;
    return names.indexOf(a.dataKey) - names.indexOf(b.dataKey);
  });

  return (
    <div
      className="rounded-lg border bg-card px-3 py-2 text-sm shadow-md"
      style={{ minWidth: 180 }}
    >
      <p className="mb-1.5 font-medium">
        {formatBucketLabel(String(label), gb)}
      </p>
      {sorted.map((entry) => (
        <div
          key={entry.dataKey}
          className={`flex items-center justify-between gap-4 ${
            entry.dataKey === "Total"
              ? "mt-1.5 border-t pt-1.5 font-semibold"
              : ""
          }`}
        >
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: entry.color }}
            />
            {entry.dataKey}
          </span>
          <span>{formatDollars(entry.value)}</span>
        </div>
      ))}
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
