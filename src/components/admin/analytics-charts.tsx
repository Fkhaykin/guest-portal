"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DateRangeFilter,
  getPresetRange,
  type DatePreset,
} from "@/components/admin/date-range-filter";
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
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Building2,
  CreditCard,
  QrCode,
  ChevronDown,
  CalendarCheck,
} from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";

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

function SourceLogo({ source, className }: { source: string; className?: string }) {
  const cn = className ?? "h-3.5 w-3.5";
  switch (source) {
    case "AirbnbIntegration":
      return (
        <svg viewBox="0 0 32 32" className={cn}>
          <rect width="32" height="32" rx="6" fill="#FF5A5F"/>
          <path d="M16 8c-1.5 0-2.8.8-3.5 2l-3.2 5.6c-.8 1.4-1.3 2.8-1.3 4.2 0 2.8 2.2 4.2 4.2 4.2 1.2 0 2.4-.5 3.8-2 1.4 1.5 2.6 2 3.8 2 2 0 4.2-1.4 4.2-4.2 0-1.4-.5-2.8-1.3-4.2L19.5 10c-.7-1.2-2-2-3.5-2zm0 2.4c.6 0 1.2.4 1.5 1l3 5.2c.6 1 1 2 1 3 0 1.4-1 2.2-2 2.2-.8 0-1.6-.5-2.8-1.8L16 19.2l-.7.8c-1.2 1.3-2 1.8-2.8 1.8-1 0-2-.8-2-2.2 0-1 .4-2 1-3l3-5.2c.3-.6.9-1 1.5-1z" fill="white"/>
        </svg>
      );
    case "BookingComIntegration":
      return (
        <svg viewBox="0 0 32 32" className={cn}>
          <rect width="32" height="32" rx="6" fill="#003580"/>
          <text x="16" y="22" textAnchor="middle" fill="white" fontSize="18" fontWeight="bold" fontFamily="Arial">B</text>
        </svg>
      );
    case "VrboIntegration":
      return (
        <svg viewBox="0 0 32 32" className={cn}>
          <rect width="32" height="32" rx="6" fill="#0e2554"/>
          <text x="16" y="21" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold" fontFamily="Arial">vrbo</text>
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 32 32" className={cn}>
          <rect width="32" height="32" rx="6" fill="#888"/>
          <text x="16" y="21" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold" fontFamily="Arial">{cleanSourceName(source).charAt(0)}</text>
        </svg>
      );
  }
}

type GroupBy = "week" | "month" | "quarter";

// ─── Types ───────────────────────────────────────────────────

type UpsellItem = {
  type: string;
  label: string;
  priceCents: number;
};

type Registration = {
  id: string;
  propertyId: string;
  propertyName: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  status: string;
  source: string | null;
  lodgifyBookingId: number | null;
  amount: number;
  createdAt: string;
  guestName: string;
  cleaningFeeCents: number;
  petFeeCents: number;
  numPets: number;
  upsells: UpsellItem[];
};

type BucketReservation = {
  guestName: string;
  checkIn: string;
  checkOut: string;
  amount: number;
  nights: number;
  registrationId: string;
  source: string | null;
  lodgifyBookingId: number | null;
};

type CleanerInvoice = {
  periodStart: string;
  totalCents: number;
};

type ApiData = {
  properties: { id: string; name: string }[];
  registrations: Registration[];
  qrScans: number;
  cleanerInvoices: CleanerInvoice[];
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

function formatCompactDollars(v: number) {
  return `$${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v)}`;
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

  // Only one chart tooltip open at a time
  const [activeChartId, setActiveChartId] = useState<string | null>(null);

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
      if (r.source === "Manual") return false; // calendar blocks
      if (!r.amount) return false; // unpaid bookings with no amount
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
    return [...seen.values()].filter((r) => !hiddenSeries.has(r.propertyName));
  }, [raw, rangeFrom, rangeTo, hiddenSeries]);

  const charts = useMemo(() => {
    if (!raw) return null;
    const propNames = raw.properties.map((p) => p.name).filter((n) => !hiddenSeries.has(n));
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

    // ── Reservation details per bucket+property (for tooltip drill-down) ──
    const reservationsByBucket: Record<string, Record<string, BucketReservation[]>> = {};
    for (const r of regs) {
      const key = toBucketKey(r.checkIn, groupBy);
      if (!reservationsByBucket[key]) reservationsByBucket[key] = {};
      if (!reservationsByBucket[key][r.propertyName]) reservationsByBucket[key][r.propertyName] = [];
      const nights = Math.max(1, Math.floor((parseDate(r.checkOut).getTime() - parseDate(r.checkIn).getTime()) / 86400000));
      reservationsByBucket[key][r.propertyName].push({
        guestName: r.guestName,
        checkIn: r.checkIn,
        checkOut: r.checkOut,
        amount: r.amount,
        nights,
        registrationId: r.id,
        source: r.source,
        lodgifyBookingId: r.lodgifyBookingId,
      });
    }

    // ── Pet Fee Revenue by property over time ──
    const petFeeBuckets: Record<string, Record<string, number>> = {};
    const petFeeReservations: Record<string, Record<string, BucketReservation[]>> = {};
    for (const r of regs) {
      if (!r.petFeeCents) continue;
      const key = toBucketKey(r.checkIn, groupBy);
      if (!petFeeBuckets[key]) petFeeBuckets[key] = {};
      petFeeBuckets[key][r.propertyName] = (petFeeBuckets[key][r.propertyName] ?? 0) + r.petFeeCents;
      if (!petFeeReservations[key]) petFeeReservations[key] = {};
      if (!petFeeReservations[key][r.propertyName]) petFeeReservations[key][r.propertyName] = [];
      petFeeReservations[key][r.propertyName].push({
        guestName: `${r.guestName} (${r.numPets} pet${r.numPets !== 1 ? "s" : ""})`,
        checkIn: r.checkIn,
        checkOut: r.checkOut,
        amount: r.petFeeCents,
        nights: 0,
        registrationId: r.id,
        source: r.source,
        lodgifyBookingId: r.lodgifyBookingId,
      });
    }
    const petFeeKeys = Object.keys(petFeeBuckets).sort();
    const petFeeOverTime = petFeeKeys.map((key) => {
      const entry: Record<string, unknown> = { bucket: key };
      for (const name of propNames) entry[name] = (petFeeBuckets[key]?.[name] ?? 0) / 100;
      return entry;
    });

    // ── Cleaning Fee Revenue by property over time ──
    const cleanFeeBuckets: Record<string, Record<string, number>> = {};
    const cleanFeeReservations: Record<string, Record<string, BucketReservation[]>> = {};
    for (const r of regs) {
      if (!r.cleaningFeeCents) continue;
      const key = toBucketKey(r.checkIn, groupBy);
      if (!cleanFeeBuckets[key]) cleanFeeBuckets[key] = {};
      cleanFeeBuckets[key][r.propertyName] = (cleanFeeBuckets[key][r.propertyName] ?? 0) + r.cleaningFeeCents;
      if (!cleanFeeReservations[key]) cleanFeeReservations[key] = {};
      if (!cleanFeeReservations[key][r.propertyName]) cleanFeeReservations[key][r.propertyName] = [];
      cleanFeeReservations[key][r.propertyName].push({
        guestName: r.guestName,
        checkIn: r.checkIn,
        checkOut: r.checkOut,
        amount: r.cleaningFeeCents,
        nights: 0,
        registrationId: r.id,
        source: r.source,
        lodgifyBookingId: r.lodgifyBookingId,
      });
    }
    const cleanFeeKeys = Object.keys(cleanFeeBuckets).sort();
    const cleaningFeeOverTime = cleanFeeKeys.map((key) => {
      const entry: Record<string, unknown> = { bucket: key };
      for (const name of propNames) entry[name] = (cleanFeeBuckets[key]?.[name] ?? 0) / 100;
      return entry;
    });

    // ── Add-ons Revenue by upsell type over time ──
    const addonBuckets: Record<string, Record<string, number>> = {};
    const addonReservations: Record<string, Record<string, BucketReservation[]>> = {};
    const addonTypeSet = new Set<string>();
    for (const r of regs) {
      if (!r.upsells.length) continue;
      const key = toBucketKey(r.checkIn, groupBy);
      for (const u of r.upsells) {
        const typeName = u.label || u.type;
        addonTypeSet.add(typeName);
        if (!addonBuckets[key]) addonBuckets[key] = {};
        addonBuckets[key][typeName] = (addonBuckets[key][typeName] ?? 0) + u.priceCents;
        if (!addonReservations[key]) addonReservations[key] = {};
        if (!addonReservations[key][typeName]) addonReservations[key][typeName] = [];
        addonReservations[key][typeName].push({
          guestName: `${r.guestName} — ${r.propertyName}`,
          checkIn: r.checkIn,
          checkOut: r.checkOut,
          amount: u.priceCents,
          nights: 0,
          registrationId: r.id,
          source: r.source,
          lodgifyBookingId: r.lodgifyBookingId,
        });
      }
    }
    const addonTypes = [...addonTypeSet].sort();
    const addonKeys = Object.keys(addonBuckets).sort();
    const addonsOverTime = addonKeys.map((key) => {
      const entry: Record<string, unknown> = { bucket: key };
      let total = 0;
      for (const type of addonTypes) {
        const val = (addonBuckets[key]?.[type] ?? 0) / 100;
        entry[type] = val;
        total += val;
      }
      entry["Total"] = total;
      return entry;
    });

    // ── Revenue vs Profit over time ──
    const revProfitBuckets: Record<string, { revenue: number; cleaningCost: number }> = {};
    for (const r of regs) {
      const key = toBucketKey(r.checkIn, groupBy);
      if (!revProfitBuckets[key]) revProfitBuckets[key] = { revenue: 0, cleaningCost: 0 };
      revProfitBuckets[key].revenue += r.amount;
    }
    // Bucket approved/paid cleaner invoices by their period_start date
    for (const inv of (raw.cleanerInvoices ?? [])) {
      const d = parseDate(inv.periodStart);
      if (rangeFrom && d < rangeFrom) continue;
      if (rangeTo && d > rangeTo) continue;
      const key = toBucketKey(inv.periodStart, groupBy);
      if (!revProfitBuckets[key]) revProfitBuckets[key] = { revenue: 0, cleaningCost: 0 };
      revProfitBuckets[key].cleaningCost += inv.totalCents;
    }
    const revProfitKeys = Object.keys(revProfitBuckets).sort();
    const revenueProfitOverTime = revProfitKeys.map((key) => ({
      bucket: key,
      "Booking Revenue": revProfitBuckets[key].revenue / 100,
      "Cleaning Cost": revProfitBuckets[key].cleaningCost / 100,
      "Profit": (revProfitBuckets[key].revenue - revProfitBuckets[key].cleaningCost) / 100,
    }));

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
      reservationsByBucket,
      petFeeOverTime,
      petFeeReservations,
      cleaningFeeOverTime,
      cleanFeeReservations,
      addonsOverTime,
      addonTypes,
      addonReservations,
      revenueProfitOverTime,
      stats: { totalRevenue, totalBookings: regs.length, activeBookings: activeCount },
    };
  }, [raw, regs, groupBy, rangeFrom, rangeTo, hiddenSeries]);

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
            <Card key={i}>
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

  const propNames = raw.properties.map((p) => p.name).filter((n) => !hiddenSeries.has(n));
  const { stats } = charts;
  const groupLabel =
    groupBy === "week" ? "Weekly" : groupBy === "quarter" ? "Quarterly" : "Monthly";
  const periodLabel = groupBy === "week" ? "Week" : groupBy === "quarter" ? "Quarter" : "Month";

  return (
    <div className="space-y-3">
      {/* Controls row: date range + property filter + group by */}
      <div className="flex items-center gap-2">
        <DateRangeFilter
          preset={preset}
          customFrom={customFrom}
          customTo={customTo}
          onApply={(p, from, to) => {
            setPreset(p);
            setCustomFrom(from);
            setCustomTo(to);
          }}
        />
        {raw && (
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-input bg-background text-xs font-medium hover:bg-accent hover:text-accent-foreground transition-colors shrink-0">
              <Building2 className="h-3.5 w-3.5" />
              Properties
              {hiddenSeries.size > 0 && (
                <span className="rounded-full bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 leading-none">
                  {raw.properties.length - hiddenSeries.size}/{raw.properties.length}
                </span>
              )}
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-48 max-w-[calc(100vw-2rem)] p-2" style={{ width: "auto" }}>
              <div className="flex items-center justify-between gap-4 px-1 pb-1.5">
                <span className="text-xs text-muted-foreground">Filter by property</span>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setHiddenSeries(new Set())}
                    className="text-[10px] text-muted-foreground underline hover:text-foreground"
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setHiddenSeries(new Set(raw.properties.map((p) => p.name)))}
                    className="text-[10px] text-muted-foreground underline hover:text-foreground"
                  >
                    None
                  </button>
                </div>
              </div>
              <DropdownMenuSeparator />
              {raw.properties.map((p, i) => (
                <DropdownMenuCheckboxItem
                  key={p.name}
                  checked={!hiddenSeries.has(p.name)}
                  onCheckedChange={() => toggleSeries(p.name)}
                  closeOnClick={false}
                  className="text-xs gap-2"
                >
                  <span
                    className="inline-block h-2 w-2 rounded-full shrink-0"
                    style={{ background: COLORS[i % COLORS.length] }}
                  />
                  {p.name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-muted-foreground hidden sm:inline">Group by</span>
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
            <SelectTrigger size="sm" className="w-24 sm:w-28">
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
      <div className="stagger-children grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          icon={CreditCard}
          tone="success"
          value={
            <>
              <span className="sm:hidden">{formatCompactDollars(stats.totalRevenue / 100)}</span>
              <span className="hidden sm:inline">{formatDollars(stats.totalRevenue / 100)}</span>
            </>
          }
          label="Revenue"
          hint="In selected range"
        />
        <StatCard
          icon={CalendarCheck}
          value={stats.totalBookings}
          label="Bookings"
          hint={`${stats.activeBookings} currently active`}
        />
        <StatCard
          icon={Building2}
          value={raw.properties.length}
          label="Properties"
          hint="Synced from Lodgify"
        />
        <StatCard
          icon={QrCode}
          value={raw.qrScans.toLocaleString()}
          label="QR Scans"
          hint="Total across all codes"
        />
      </div>

      {/* Charts */}
      <div className="stagger-children grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* 1. Revenue Over Time — line chart with checkboxes */}
        <Card className="overflow-visible" onClickCapture={() => setActiveChartId("revenue")}>
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
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs select-none">
                    <input
                      type="checkbox"
                      checked={!hiddenSeries.has("Total")}
                      onChange={() => toggleSeries("Total")}
                      className="rounded border-muted-foreground"
                    />
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: "hsl(var(--foreground))", opacity: hiddenSeries.has("Total") ? 0.3 : 1 }}
                    />
                    <span style={{ opacity: hiddenSeries.has("Total") ? 0.4 : 1 }}>Total</span>
                  </label>
                </div>
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={charts.revenueOverTime}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="bucket" tickFormatter={(v) => formatBucketLabel(v, groupBy)} className="text-xs" />
                    <YAxis tickFormatter={formatDollars} className="text-xs" />
                    <Tooltip
                      content={<RevenueTooltip groupBy={groupBy} propertyNames={propNames} hiddenSeries={hiddenSeries} reservationsByBucket={charts.reservationsByBucket} chartId="revenue" activeChartId={activeChartId} />}
                      trigger="click"
                      cursor={false}
                      allowEscapeViewBox={{ x: true, y: true }}
                      wrapperStyle={{ zIndex: 10, pointerEvents: "auto" }}
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

        {/* 2. Revenue vs Profit — line chart */}
        <Card className="overflow-visible" onClickCapture={() => setActiveChartId("revProfit")}>
          <CardHeader>
            <CardTitle>Revenue vs Profit</CardTitle>
            <CardDescription>{groupLabel} booking revenue, cleaning cost, and net profit</CardDescription>
          </CardHeader>
          <CardContent>
            {charts.revenueProfitOverTime.length === 0 ? (
              <EmptyState label="No revenue data in this range" />
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={charts.revenueProfitOverTime}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="bucket" tickFormatter={(v) => formatBucketLabel(v, groupBy)} className="text-xs" />
                  <YAxis tickFormatter={formatDollars} className="text-xs" />
                  <Tooltip
                    labelFormatter={(l: unknown) => formatBucketLabel(String(l), groupBy)}
                    formatter={((v: ValueType) => [formatDollars(v as number)]) as never}
                    contentStyle={TOOLTIP_STYLE}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="Booking Revenue" stroke="hsl(220, 70%, 55%)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Cleaning Cost" stroke="hsl(0, 65%, 55%)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Profit" stroke="hsl(160, 60%, 45%)" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* 3. Occupancy Rate — grouped bar over time */}
        <Card className="overflow-visible" onClickCapture={() => setActiveChartId("occupancy")}>
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
                    content={<BarTooltip groupBy={groupBy} propertyNames={propNames} formatter={(v) => `${v}%`} reservationsByBucket={charts.reservationsByBucket} showNights chartId="occupancy" activeChartId={activeChartId} />}
                    trigger="click"
                    cursor={false}
                    allowEscapeViewBox={{ x: true, y: true }}
                    wrapperStyle={{ zIndex: 10, pointerEvents: "auto" }}
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
        <Card className="overflow-visible" onClickCapture={() => setActiveChartId("revByProp")}>
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
                    content={<BarTooltip groupBy={groupBy} propertyNames={propNames} formatter={formatDollars} reservationsByBucket={charts.reservationsByBucket} chartId="revByProp" activeChartId={activeChartId} />}
                    trigger="click"
                    cursor={false}
                    allowEscapeViewBox={{ x: true, y: true }}
                    wrapperStyle={{ zIndex: 10, pointerEvents: "auto" }}
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
        <Card className="overflow-visible" onClickCapture={() => setActiveChartId("bookings")}>
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
                    content={<BarTooltip groupBy={groupBy} propertyNames={propNames} formatter={(v) => String(v)} reservationsByBucket={charts.reservationsByBucket} chartId="bookings" activeChartId={activeChartId} />}
                    trigger="click"
                    cursor={false}
                    allowEscapeViewBox={{ x: true, y: true }}
                    wrapperStyle={{ zIndex: 10, pointerEvents: "auto" }}
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
        <Card className="overflow-visible">
          <CardHeader>
            <CardTitle>Average Stay Duration</CardTitle>
            <CardDescription>Nights per booking by property</CardDescription>
          </CardHeader>
          <CardContent>
            {charts.avgStayByProperty.length === 0 ? (
              <EmptyState />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={charts.avgStayByProperty}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="property" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    formatter={((v: ValueType) => `${v} nights`) as never}
                    contentStyle={TOOLTIP_STYLE}
                  />
                  <Bar dataKey="avgNights" radius={[6, 6, 0, 0]}>
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
        <Card className="overflow-visible">
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
        <Card className="overflow-visible">
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

        {/* 8. Cleaning Fee Revenue */}
        <Card className="overflow-visible" onClickCapture={() => setActiveChartId("cleanFees")}>
          <CardHeader>
            <CardTitle>Cleaning Fee Revenue</CardTitle>
            <CardDescription>{groupLabel} cleaning fees by property</CardDescription>
          </CardHeader>
          <CardContent>
            {charts.cleaningFeeOverTime.length === 0 ? (
              <EmptyState label="No cleaning fee data" />
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={charts.cleaningFeeOverTime}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="bucket" tickFormatter={(v) => formatBucketLabel(v, groupBy)} className="text-xs" />
                  <YAxis tickFormatter={formatDollars} className="text-xs" />
                  <Tooltip
                    content={<BarTooltip groupBy={groupBy} propertyNames={propNames} formatter={formatDollars} reservationsByBucket={charts.cleanFeeReservations} chartId="cleanFees" activeChartId={activeChartId} />}
                    trigger="click"
                    cursor={false}
                    allowEscapeViewBox={{ x: true, y: true }}
                    wrapperStyle={{ zIndex: 10, pointerEvents: "auto" }}
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

        {/* 9. Pet Fee Revenue */}
        <Card className="overflow-visible" onClickCapture={() => setActiveChartId("petFees")}>
          <CardHeader>
            <CardTitle>Pet Fee Revenue</CardTitle>
            <CardDescription>{groupLabel} pet fees by property (fee × number of pets)</CardDescription>
          </CardHeader>
          <CardContent>
            {charts.petFeeOverTime.length === 0 ? (
              <EmptyState label="No pet fee data" />
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={charts.petFeeOverTime}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="bucket" tickFormatter={(v) => formatBucketLabel(v, groupBy)} className="text-xs" />
                  <YAxis tickFormatter={formatDollars} className="text-xs" />
                  <Tooltip
                    content={<BarTooltip groupBy={groupBy} propertyNames={propNames} formatter={formatDollars} reservationsByBucket={charts.petFeeReservations} chartId="petFees" activeChartId={activeChartId} />}
                    trigger="click"
                    cursor={false}
                    allowEscapeViewBox={{ x: true, y: true }}
                    wrapperStyle={{ zIndex: 10, pointerEvents: "auto" }}
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

        {/* 10. Add-ons Revenue */}
        <Card className="overflow-visible" onClickCapture={() => setActiveChartId("addons")}>
          <CardHeader>
            <CardTitle>Add-ons Revenue</CardTitle>
            <CardDescription>{groupLabel} upsell revenue by type</CardDescription>
          </CardHeader>
          <CardContent>
            {charts.addonsOverTime.length === 0 ? (
              <EmptyState label="No add-on data" />
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={charts.addonsOverTime}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="bucket" tickFormatter={(v) => formatBucketLabel(v, groupBy)} className="text-xs" />
                  <YAxis tickFormatter={formatDollars} className="text-xs" />
                  <Tooltip
                    content={<BarTooltip groupBy={groupBy} propertyNames={charts.addonTypes} formatter={formatDollars} reservationsByBucket={charts.addonReservations} chartId="addons" activeChartId={activeChartId} />}
                    trigger="click"
                    cursor={false}
                    allowEscapeViewBox={{ x: true, y: true }}
                    wrapperStyle={{ zIndex: 10, pointerEvents: "auto" }}
                  />
                  <Legend />
                  {charts.addonTypes.map((type, i) => (
                    <Bar key={type} dataKey={type} fill={COLORS[i % COLORS.length]} radius={[3, 3, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Module-level expanded state so it survives Recharts tooltip remounts
const expandedSet = new Set<string>();

function formatCheckIn(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ReservationList({ reservations, showNights }: { reservations: BucketReservation[]; showNights?: boolean }) {
  if (!reservations?.length) return null;
  const sorted = [...reservations].sort((a, b) => a.checkOut.localeCompare(b.checkOut));
  return (
    <div className="ml-4 mt-0.5 mb-1 space-y-px">
      {sorted.map((r, i) => {
        const lodgifyUrl = r.lodgifyBookingId
          ? `https://app.lodgify.com/reservations/inbox/${r.lodgifyBookingId}`
          : undefined;
        return (
          <div key={i} className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
            <Link href={`/admin/reservations/${r.registrationId}`} className="truncate max-w-[140px] underline hover:text-foreground transition-colors">
              {r.guestName}
            </Link>
            <span className="flex items-center gap-2 shrink-0">
              {r.source && lodgifyUrl ? (
                <a href={lodgifyUrl} target="_blank" rel="noopener noreferrer" className="hover:opacity-70 transition-opacity" onClick={(e) => e.stopPropagation()}>
                  <SourceLogo source={r.source} />
                </a>
              ) : r.source ? (
                <span className="opacity-50"><SourceLogo source={r.source} /></span>
              ) : null}
              <span>{formatCheckIn(r.checkIn)}</span>
              <span className="font-medium">{showNights ? `${r.nights}n` : formatDollars(r.amount / 100)}</span>
            </span>
          </div>
        );
      })}
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
  reservationsByBucket,
  chartId,
  activeChartId,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string }>;
  label?: string;
  groupBy: GroupBy;
  propertyNames: string[];
  hiddenSeries: Set<string>;
  reservationsByBucket: Record<string, Record<string, BucketReservation[]>>;
  chartId?: string;
  activeChartId?: string | null;
}) {
  const [, forceUpdate] = useState(0);
  if (!active || !payload?.length) return null;
  if (chartId && activeChartId && chartId !== activeChartId) return null;

  const bucketKey = (payload?.[0] as unknown as { payload?: Record<string, unknown> })?.payload?.bucket as string ?? String(label);
  const bucketReservations = reservationsByBucket[bucketKey] ?? {};

  const visible = payload.filter((e) => !hiddenSeries.has(e.dataKey));
  const sorted = [...visible].sort((a, b) => {
    if (a.dataKey === "Total") return 1;
    if (b.dataKey === "Total") return -1;
    return names.indexOf(a.dataKey) - names.indexOf(b.dataKey);
  });

  return (
    <ViewportClamp>
      <div className="rounded-lg border bg-card px-3 py-2 text-sm shadow-md max-h-80 overflow-y-auto" style={{ minWidth: 220, maxWidth: 360 }}>
        <p className="mb-1.5 font-medium">{formatBucketLabel(bucketKey, gb)}</p>
        {sorted.map((entry) => {
          const resList = entry.dataKey !== "Total" ? bucketReservations[entry.dataKey] : undefined;
          const expandKey = `${bucketKey}:${entry.dataKey}`;
          const isExpanded = expandedSet.has(expandKey);
          const hasReservations = resList && resList.length > 0;
          return (
            <div key={entry.dataKey}>
              <div
                className={`flex items-center justify-between gap-4 ${
                  entry.dataKey === "Total" ? "mt-1.5 border-t pt-1.5 font-semibold" : ""
                } ${hasReservations ? "cursor-pointer hover:bg-muted/50 -mx-1 px-1 rounded" : ""}`}
                onClick={hasReservations ? (e: React.MouseEvent) => {
                  e.stopPropagation();
                  if (expandedSet.has(expandKey)) expandedSet.delete(expandKey);
                  else expandedSet.add(expandKey);
                  forceUpdate((n) => n + 1);
                } : undefined}
              >
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: entry.color }} />
                  {entry.dataKey}
                </span>
                <span className="flex items-center gap-1.5">
                  <span>{formatDollars(entry.value)}</span>
                  {hasReservations && (
                    <span className="text-[10px] text-muted-foreground w-3">{isExpanded ? "▾" : "▸"}</span>
                  )}
                </span>
              </div>
              {isExpanded && resList && <ReservationList reservations={resList} />}
            </div>
          );
        })}
      </div>
    </ViewportClamp>
  );
}

function BarTooltip({
  active,
  payload,
  label,
  groupBy: gb,
  propertyNames: names,
  formatter: fmt,
  reservationsByBucket,
  showNights,
  chartId,
  activeChartId,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string }>;
  label?: string;
  groupBy: GroupBy;
  propertyNames: string[];
  formatter: (v: number) => string;
  reservationsByBucket: Record<string, Record<string, BucketReservation[]>>;
  showNights?: boolean;
  chartId?: string;
  activeChartId?: string | null;
}) {
  const [, forceUpdate] = useState(0);
  if (!active || !payload?.length) return null;
  if (chartId && activeChartId && chartId !== activeChartId) return null;

  const bucketKey = (payload?.[0] as unknown as { payload?: Record<string, unknown> })?.payload?.bucket as string ?? String(label);
  const bucketReservations = reservationsByBucket[bucketKey] ?? {};

  const sorted = [...payload].sort(
    (a, b) => names.indexOf(a.dataKey) - names.indexOf(b.dataKey)
  );

  return (
    <ViewportClamp>
      <div className="rounded-lg border bg-card px-3 py-2 text-sm shadow-md max-h-80 overflow-y-auto" style={{ minWidth: 220, maxWidth: 360 }}>
        <p className="mb-1.5 font-medium">{formatBucketLabel(bucketKey, gb)}</p>
        {sorted.map((entry) => {
          const resList = bucketReservations[entry.dataKey];
          const expandKey = `${bucketKey}:${entry.dataKey}`;
          const isExpanded = expandedSet.has(expandKey);
          const hasReservations = resList && resList.length > 0;
          return (
            <div key={entry.dataKey}>
              <div
                className={`flex items-center justify-between gap-4 ${hasReservations ? "cursor-pointer hover:bg-muted/50 -mx-1 px-1 rounded" : ""}`}
                onClick={hasReservations ? (e: React.MouseEvent) => {
                  e.stopPropagation();
                  if (expandedSet.has(expandKey)) expandedSet.delete(expandKey);
                  else expandedSet.add(expandKey);
                  forceUpdate((n) => n + 1);
                } : undefined}
              >
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: entry.color }} />
                  {entry.dataKey}
                </span>
                <span className="flex items-center gap-1.5">
                  <span>{fmt(entry.value)}</span>
                  {showNights && resList && <span className="text-muted-foreground">({resList.reduce((s, r) => s + r.nights, 0)}n)</span>}
                  {hasReservations && (
                    <span className="text-[10px] text-muted-foreground w-3">{isExpanded ? "▾" : "▸"}</span>
                  )}
                </span>
              </div>
              {isExpanded && resList && <ReservationList reservations={resList} showNights={showNights} />}
            </div>
          );
        })}
      </div>
    </ViewportClamp>
  );
}

function ViewportClamp({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Temporarily remove transform to measure natural position
    el.style.transform = "";
    const rect = el.getBoundingClientRect();
    let dx = 0;
    let dy = 0;
    if (rect.right > window.innerWidth - 8) dx = window.innerWidth - 8 - rect.right;
    if (rect.left < 8) dx = 8 - rect.left;
    if (rect.bottom > window.innerHeight - 8) dy = window.innerHeight - 8 - rect.bottom;
    if (rect.top < 8) dy = 8 - rect.top;
    dx = Math.round(dx);
    dy = Math.round(dy);
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    if (dx !== offsetRef.current.x || dy !== offsetRef.current.y) {
      offsetRef.current = { x: dx, y: dy };
      setOffset({ x: dx, y: dy });
    }
  }); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={ref} style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}>
      {children}
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
