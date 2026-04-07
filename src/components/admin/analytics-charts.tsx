"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
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

const TOOLTIP_STYLE: React.CSSProperties = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: "8px",
  fontSize: "13px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
  padding: "8px 12px",
};

const SOURCE_RENAME: Record<string, string> = {
  AirbnbIntegration: "Airbnb",
  BookingComIntegration: "Booking.com",
  VrboIntegration: "VRBO",
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
  propertyName: string;
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

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

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
  const [y, m, d] = dateStr.split("-").map(Number);
  if (groupBy === "week") {
    const date = new Date(y, m - 1, d);
    const dow = date.getDay();
    date.setDate(date.getDate() - ((dow + 6) % 7));
    const wy = date.getFullYear();
    const wm = String(date.getMonth() + 1).padStart(2, "0");
    const wd = String(date.getDate()).padStart(2, "0");
    return `${wy}-${wm}-${wd}`;
  }
  if (groupBy === "quarter") {
    const q = Math.floor((m - 1) / 3) + 1;
    return `${y}-Q${q}`;
  }
  return `${y}-${String(m).padStart(2, "0")}`;
}

function formatBucketLabel(key: string, groupBy: GroupBy): string {
  if (groupBy === "week") {
    const [y, m, d] = key.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  if (groupBy === "quarter") return key;
  const MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const [yr, mo] = key.split("-");
  return `${MONTHS[parseInt(mo) - 1]} ${yr.slice(2)}`;
}

function cleanSourceName(raw: string | null): string {
  if (!raw) return "Direct";
  return SOURCE_RENAME[raw] ?? raw;
}

// ─── Component ───────────────────────────────────────────────

export function AnalyticsCharts() {
  const [raw, setRaw] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<DatePreset>("1y");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>("month");

  // Revenue line visibility toggles
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

  const toggleSeries = useCallback((name: string) => {
    setHiddenSeries((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then((r) => r.json())
      .then((d) => { setRaw(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const [rangeFrom, rangeTo] = useMemo(() => {
    if (preset === "custom") {
      return [
        customFrom ? parseDate(customFrom) : null,
        customTo ? parseDate(customTo) : null,
      ];
    }
    return getPresetRange(preset);
  }, [preset, customFrom, customTo]);

  // Filter by status + date range, then deduplicate bookings that appear on
  // multiple listings for the same house (same house + check-in + check-out).
  // Keep the copy with the highest amount.
  const regs = useMemo(() => {
    if (!raw) return [];
    const filtered = raw.registrations.filter((r) => {
      if (r.status === "cancelled") return false;
      const d = parseDate(r.checkIn);
      if (rangeFrom && d < rangeFrom) return false;
      if (rangeTo && d > rangeTo) return false;
      return true;
    });

    // Deduplicate: same house + same dates = same booking across listings
    const seen = new Map<string, Registration>();
    for (const r of filtered) {
      const key = `${r.propertyName}|${r.checkIn}|${r.checkOut}`;
      const existing = seen.get(key);
      if (!existing || r.amount > existing.amount) {
        seen.set(key, r);
      }
    }
    return [...seen.values()];
  }, [raw, rangeFrom, rangeTo]);

  const charts = useMemo(() => {
    if (!raw) return null;
    const propNames = raw.properties.map((p) => p.name);
    const from = rangeFrom ?? new Date(2020, 0, 1);
    const to = rangeTo ?? today();

    // ── Revenue over time (line chart data) ──
    const revBuckets: Record<string, Record<string, number>> = {};
    for (const r of regs) {
      if (!r.amount) continue;
      const key = toBucketKey(r.checkIn, groupBy);
      if (!revBuckets[key]) revBuckets[key] = {};
      revBuckets[key][r.propertyName] =
        (revBuckets[key][r.propertyName] ?? 0) + r.amount;
    }
    const revKeys = Object.keys(revBuckets).sort();
    const revenueOverTime = revKeys.map((key) => {
      const entry: Record<string, unknown> = { bucket: key };
      let total = 0;
      for (const name of propNames) {
        const val = (revBuckets[key]?.[name] ?? 0) / 100;
        entry[name] = val;
        total += val;
      }
      entry["Total"] = total;
      return entry;
    });

    // ── Occupancy % over time (grouped bar) ──
    // For each bucket period, compute occupancy per property
    const allBucketKeys = new Set<string>();
    for (const r of regs) allBucketKeys.add(toBucketKey(r.checkIn, groupBy));
    const sortedBuckets = [...allBucketKeys].sort();

    // Pre-compute bucket date ranges
    function bucketRange(key: string): [Date, Date] {
      if (groupBy === "week") {
        const s = parseDate(key);
        const e = new Date(s); e.setDate(e.getDate() + 7);
        return [s, e];
      }
      if (groupBy === "quarter") {
        const [y, qStr] = key.split("-Q");
        const q = parseInt(qStr);
        const s = new Date(parseInt(y), (q - 1) * 3, 1);
        const e = new Date(parseInt(y), q * 3, 1);
        return [s, e];
      }
      // month
      const [y, m] = key.split("-").map(Number);
      return [new Date(y, m - 1, 1), new Date(y, m, 1)];
    }

    const occupancyOverTime = sortedBuckets.map((key) => {
      const [bStart, bEnd] = bucketRange(key);
      const clampStart = bStart < from ? from : bStart;
      const clampEnd = bEnd > to ? to : bEnd;
      const periodDays = Math.max(1, Math.floor((clampEnd.getTime() - clampStart.getTime()) / 86400000));
      const entry: Record<string, unknown> = { bucket: key };
      for (const name of propNames) {
        const propRegs = regs.filter((r) => r.propertyName === name);
        const days = new Set<number>();
        for (const r of propRegs) {
          const ci = parseDate(r.checkIn);
          const co = parseDate(r.checkOut);
          const s = ci > clampStart ? ci : clampStart;
          const e = co < clampEnd ? co : clampEnd;
          let day = new Date(s);
          while (day < e) {
            days.add(day.getTime());
            day = new Date(day.getTime() + 86400000);
          }
        }
        entry[name] = Math.round((days.size / periodDays) * 100);
      }
      return entry;
    });

    // ── Revenue by property over time (grouped bar) ──
    const revenueByPropTime = revKeys.map((key) => {
      const entry: Record<string, unknown> = { bucket: key };
      for (const name of propNames) {
        entry[name] = (revBuckets[key]?.[name] ?? 0) / 100;
      }
      return entry;
    });

    // ── Bookings per property per period (grouped bar) ──
    const bookBuckets: Record<string, Record<string, number>> = {};
    for (const r of regs) {
      const key = toBucketKey(r.checkIn, groupBy);
      if (!bookBuckets[key]) bookBuckets[key] = {};
      bookBuckets[key][r.propertyName] =
        (bookBuckets[key][r.propertyName] ?? 0) + 1;
    }
    const bookKeys = Object.keys(bookBuckets).sort();
    const bookingsPerPeriod = bookKeys.map((key) => {
      const entry: Record<string, unknown> = { bucket: key };
      for (const name of propNames) {
        entry[name] = bookBuckets[key]?.[name] ?? 0;
      }
      return entry;
    });

    // ── Avg stay duration ──
    const avgStayByProperty = propNames.map((name) => {
      const propRegs = regs.filter((r) => r.propertyName === name);
      if (!propRegs.length) return { property: name, avgNights: 0 };
      const nights = propRegs.reduce((s, r) =>
        s + Math.max(1, Math.floor((parseDate(r.checkOut).getTime() - parseDate(r.checkIn).getTime()) / 86400000)), 0);
      return { property: name, avgNights: Math.round((nights / propRegs.length) * 10) / 10 };
    });

    // ── Guest volume ──
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

    // ── Booking sources ──
    const srcCount: Record<string, number> = {};
    for (const r of regs) {
      const src = cleanSourceName(r.source);
      srcCount[src] = (srcCount[src] ?? 0) + 1;
    }
    const sourceBreakdown = Object.entries(srcCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Stats
    const totalRevenue = regs.reduce((s, r) => s + r.amount, 0);
    const activeCount = regs.filter((r) => r.status === "active").length;

    return {
      revenueOverTime,
      occupancyOverTime,
      revenueByPropTime,
      bookingsPerPeriod,
      avgStayByProperty,
      guestVolume,
      sourceBreakdown,
      stats: { totalRevenue, totalBookings: regs.length, activeBookings: activeCount },
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

  const propNames = raw.properties.map((p) => p.name);
  const allSeriesNames = [...propNames, "Total"];
  const { stats } = charts;
  const groupLabel =
    groupBy === "week" ? "Weekly" : groupBy === "quarter" ? "Quarterly" : "Monthly";
  const periodLabel = groupBy === "week" ? "Week" : groupBy === "quarter" ? "Quarter" : "Month";

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
            <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-7 w-36 text-xs" />
            <span className="text-xs text-muted-foreground">to</span>
            <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-7 w-36 text-xs" />
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
            <div className="text-2xl font-bold">{formatDollars(stats.totalRevenue / 100)}</div>
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
            <p className="text-xs text-muted-foreground">{stats.activeBookings} currently active</p>
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
            <div className="text-2xl font-bold">{raw.qrScans.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Total across all codes</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* 1. Revenue Over Time — line chart with checkboxes */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue Over Time</CardTitle>
            <CardDescription>{groupLabel} booking revenue by property</CardDescription>
          </CardHeader>
          <CardContent>
            {charts.revenueOverTime.length === 0 ? (
              <EmptyState label="No revenue data in this range" />
            ) : (
              <>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
                  {allSeriesNames.map((name, i) => {
                    const color = name === "Total"
                      ? "hsl(var(--foreground))"
                      : COLORS[i % COLORS.length];
                    const hidden = hiddenSeries.has(name);
                    return (
                      <label
                        key={name}
                        className="flex items-center gap-1.5 cursor-pointer text-xs select-none"
                      >
                        <input
                          type="checkbox"
                          checked={!hidden}
                          onChange={() => toggleSeries(name)}
                          className="rounded border-muted-foreground"
                        />
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ background: color, opacity: hidden ? 0.3 : 1 }}
                        />
                        <span style={{ opacity: hidden ? 0.4 : 1 }}>{name}</span>
                      </label>
                    );
                  })}
                </div>
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={charts.revenueOverTime}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="bucket" tickFormatter={(v) => formatBucketLabel(v, groupBy)} className="text-xs" />
                    <YAxis tickFormatter={formatDollars} className="text-xs" />
                    <Tooltip
                      content={<RevenueTooltip groupBy={groupBy} propertyNames={propNames} hiddenSeries={hiddenSeries} />}
                      wrapperStyle={{ zIndex: 10 }}
                    />
                    {propNames.map((name, i) =>
                      !hiddenSeries.has(name) ? (
                        <Line key={name} type="monotone" dataKey={name} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
                      ) : null
                    )}
                    {!hiddenSeries.has("Total") && (
                      <Line type="monotone" dataKey="Total" stroke="hsl(var(--foreground))" strokeWidth={2.5} strokeDasharray="6 3" dot={false} />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </>
            )}
          </CardContent>
        </Card>

        {/* 2. Occupancy Rate — grouped bar over time */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Occupancy Rate</CardTitle>
            <CardDescription>{groupLabel} occupancy % by property</CardDescription>
          </CardHeader>
          <CardContent>
            {charts.occupancyOverTime.length === 0 ? (
              <EmptyState />
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={charts.occupancyOverTime}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="bucket" tickFormatter={(v) => formatBucketLabel(v, groupBy)} className="text-xs" />
                  <YAxis tickFormatter={(v) => `${v}%`} domain={[0, 100]} className="text-xs" />
                  <Tooltip
                    content={<BarTooltip groupBy={groupBy} propertyNames={propNames} formatter={(v) => `${v}%`} />}
                    wrapperStyle={{ zIndex: 10 }}
                  />
                  <Legend />
                  {propNames.map((name, i) => (
                    <Bar key={name} dataKey={name} fill={COLORS[i % COLORS.length]} radius={[3, 3, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* 3. Revenue by Property — grouped bar over time */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue by Property</CardTitle>
            <CardDescription>{groupLabel} revenue per property</CardDescription>
          </CardHeader>
          <CardContent>
            {charts.revenueByPropTime.length === 0 ? (
              <EmptyState />
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={charts.revenueByPropTime}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="bucket" tickFormatter={(v) => formatBucketLabel(v, groupBy)} className="text-xs" />
                  <YAxis tickFormatter={formatDollars} className="text-xs" />
                  <Tooltip
                    content={<BarTooltip groupBy={groupBy} propertyNames={propNames} formatter={formatDollars} />}
                    wrapperStyle={{ zIndex: 10 }}
                  />
                  <Legend />
                  {propNames.map((name, i) => (
                    <Bar key={name} dataKey={name} fill={COLORS[i % COLORS.length]} radius={[3, 3, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* 4. Bookings Per Period — grouped bar by property */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Bookings Per {periodLabel}</CardTitle>
            <CardDescription>{groupLabel} bookings by property</CardDescription>
          </CardHeader>
          <CardContent>
            {charts.bookingsPerPeriod.length === 0 ? (
              <EmptyState />
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={charts.bookingsPerPeriod}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="bucket" tickFormatter={(v) => formatBucketLabel(v, groupBy)} className="text-xs" />
                  <YAxis allowDecimals={false} className="text-xs" />
                  <Tooltip
                    content={<BarTooltip groupBy={groupBy} propertyNames={propNames} formatter={(v) => String(v)} />}
                    wrapperStyle={{ zIndex: 10 }}
                  />
                  <Legend />
                  {propNames.map((name, i) => (
                    <Bar key={name} dataKey={name} fill={COLORS[i % COLORS.length]} radius={[3, 3, 0, 0]} />
                  ))}
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
                  <YAxis dataKey="property" type="category" width={120} className="text-xs" />
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
                  <XAxis dataKey="bucket" tickFormatter={(v) => formatBucketLabel(v, groupBy)} className="text-xs" />
                  <YAxis allowDecimals={false} className="text-xs" />
                  <Tooltip labelFormatter={(l) => formatBucketLabel(String(l), groupBy)} contentStyle={TOOLTIP_STYLE} />
                  <Area type="monotone" dataKey="guests" stroke="hsl(160, 60%, 45%)" fill="hsl(160, 60%, 45%)" fillOpacity={0.15} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* 7. Booking Sources */}
        <Card>
          <CardHeader>
            <CardTitle>Booking Sources</CardTitle>
            <CardDescription>Where bookings come from</CardDescription>
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
  hiddenSeries,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string }>;
  label?: string;
  groupBy: GroupBy;
  propertyNames: string[];
  hiddenSeries: Set<string>;
}) {
  if (!active || !payload?.length) return null;

  const visible = payload.filter((e) => !hiddenSeries.has(e.dataKey));
  const sorted = [...visible].sort((a, b) => {
    if (a.dataKey === "Total") return 1;
    if (b.dataKey === "Total") return -1;
    return names.indexOf(a.dataKey) - names.indexOf(b.dataKey);
  });

  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-sm shadow-md" style={{ minWidth: 180 }}>
      <p className="mb-1.5 font-medium">{formatBucketLabel(String(label), gb)}</p>
      {sorted.map((entry) => (
        <div
          key={entry.dataKey}
          className={`flex items-center justify-between gap-4 ${
            entry.dataKey === "Total" ? "mt-1.5 border-t pt-1.5 font-semibold" : ""
          }`}
        >
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: entry.color }} />
            {entry.dataKey}
          </span>
          <span>{formatDollars(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

function BarTooltip({
  active,
  payload,
  label,
  groupBy: gb,
  propertyNames: names,
  formatter: fmt,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string }>;
  label?: string;
  groupBy: GroupBy;
  propertyNames: string[];
  formatter: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;

  const sorted = [...payload].sort(
    (a, b) => names.indexOf(a.dataKey) - names.indexOf(b.dataKey)
  );

  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-sm shadow-md" style={{ minWidth: 180 }}>
      <p className="mb-1.5 font-medium">{formatBucketLabel(String(label), gb)}</p>
      {sorted.map((entry) => (
        <div key={entry.dataKey} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: entry.color }} />
            {entry.dataKey}
          </span>
          <span>{fmt(entry.value)}</span>
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
