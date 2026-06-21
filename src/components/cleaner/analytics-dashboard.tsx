"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CalendarClock,
  DollarSign,
  ClipboardList,
  TrendingUp,
  Sparkles,
  X,
  PiggyBank,
  Info,
  BarChart3,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type MonthData = {
  month: string;
  cleaningRevenue: number;
  petFeeRevenue: number;
  futureCleaningRevenue: number;
  futurePetFeeRevenue: number;
};

type PropertyData = {
  name: string;
  cleanings: number;
  cleaningRevenue: number;
  petFeeRevenue: number;
  totalRevenue: number;
  futureCleanings: number;
  futureRevenue: number;
};

function formatCents(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function formatMonthLabel(month: string) {
  const [year, m] = month.split("-");
  const date = new Date(Number(year), Number(m) - 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const nonZero = payload.filter((e) => e.value > 0);
  if (nonZero.length === 0) return null;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-md text-sm">
      <p className="font-medium mb-1">{label}</p>
      {nonZero.map((entry) => (
        <p key={entry.name} className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: entry.color }}
          />
          {entry.name}: {formatCents(entry.value)}
        </p>
      ))}
    </div>
  );
}

const TAX_RATE_KEY = "cleaner-tax-savings-rate";

export function AnalyticsDashboard({
  upcomingCleanings,
  openBalance,
  futureRevenue,
  monthlyRevenue,
  byProperty,
  filterFrom,
  filterTo,
}: {
  upcomingCleanings: number;
  openBalance: number;
  futureRevenue: number;
  monthlyRevenue: MonthData[];
  byProperty: PropertyData[];
  filterFrom?: string;
  filterTo?: string;
}) {
  const router = useRouter();
  const [from, setFrom] = useState(filterFrom || "");
  const [to, setTo] = useState(filterTo || "");
  const [taxRate, setTaxRate] = useState(25);
  const [isEditingRate, setIsEditingRate] = useState(false);
  const [rateInput, setRateInput] = useState("25");

  useEffect(() => {
    const saved = localStorage.getItem(TAX_RATE_KEY);
    if (saved) {
      const parsed = Number(saved);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
        setTaxRate(parsed);
        setRateInput(String(parsed));
      }
    }
  }, []);

  function saveRate() {
    const parsed = Number(rateInput);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
      setTaxRate(parsed);
      localStorage.setItem(TAX_RATE_KEY, String(parsed));
    }
    setIsEditingRate(false);
  }

  const totalRevenue = byProperty.reduce((sum, p) => sum + p.totalRevenue, 0);
  const totalCleanings = byProperty.reduce((sum, p) => sum + p.cleanings, 0);
  const estimatedTax = Math.round(totalRevenue * (taxRate / 100));

  const chartData = monthlyRevenue.map((m) => ({
    name: formatMonthLabel(m.month),
    "Cleaning Fees": m.cleaningRevenue,
    "Pet Fees": m.petFeeRevenue,
    "Projected Cleaning": m.futureCleaningRevenue,
    "Projected Pet Fees": m.futurePetFeeRevenue,
  }));

  function applyFilter() {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString();
    router.push(qs ? `/cleaner?${qs}` : "/cleaner");
  }

  function clearFilter() {
    setFrom("");
    setTo("");
    router.push("/cleaner");
  }

  const hasFilter = filterFrom || filterTo;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <PageHeader title="Dashboard" />

      {/* Date filter */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                From
              </label>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                To
              </label>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="col-span-2 flex gap-2">
              <Button size="sm" onClick={applyFilter} className="h-9">
                Apply
              </Button>
              {hasFilter && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={clearFilter}
                  className="h-9 px-2"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/cleaner/tasks" className="block">
          <StatCard
            icon={CalendarClock}
            value={upcomingCleanings}
            label="Upcoming Cleanings"
            tone="warning"
            className="hover:border-primary/50 transition-colors cursor-pointer"
          />
        </Link>

        <Link href="/cleaner/invoices" className="block">
          <StatCard
            icon={DollarSign}
            value={formatCents(openBalance)}
            label="Open Balance"
            tone="success"
            className={`hover:border-primary/50 transition-colors cursor-pointer ${openBalance > 0 ? "border-success/40" : ""}`}
          />
        </Link>

        <StatCard
          icon={ClipboardList}
          value={totalCleanings}
          label="Total Cleanings"
          tone="info"
        />

        <StatCard
          icon={TrendingUp}
          value={formatCents(totalRevenue)}
          label="Earned Revenue"
          tone="success"
        />

        {/* Estimated tax savings tile */}
        <Card className="col-span-2 border-warning/30">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-warning/15 text-warning p-2">
                <PiggyBank className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold">
                    {formatCents(estimatedTax)}
                  </p>
                  {isEditingRate ? (
                    <div className="flex items-center gap-1 ml-auto">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={rateInput}
                        onChange={(e) => setRateInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && saveRate()}
                        onBlur={saveRate}
                        className="h-7 w-16 text-xs text-center"
                        autoFocus
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setRateInput(String(taxRate));
                        setIsEditingRate(true);
                      }}
                      className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
                    >
                      {taxRate}% rate &middot; Edit
                    </button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Set Aside for Tax Payments
                </p>
              </div>
            </div>
            <div className="mt-2.5 flex items-start gap-1.5">
              <Info className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Not financial or tax advice. Based on the date range selected, this
                is the amount you should set aside for potential tax liabilities.
                Consult a tax professional for your situation.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Future revenue banner */}
      {futureRevenue > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-info/30 bg-info/10 px-4 py-3">
          <Sparkles className="h-5 w-5 text-info shrink-0" />
          <p className="text-sm">
            <span className="font-semibold text-info">
              {formatCents(futureRevenue)}
            </span>{" "}
            <span className="text-muted-foreground">
              projected from upcoming bookings
            </span>
          </p>
        </div>
      )}

      {/* Revenue chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Monthly Revenue
          </CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.every(
            (d) =>
              d["Cleaning Fees"] === 0 &&
              d["Pet Fees"] === 0 &&
              d["Projected Cleaning"] === 0 &&
              d["Projected Pet Fees"] === 0
          ) ? (
            <EmptyState
              icon={BarChart3}
              title="No revenue data yet"
              description="Completed cleanings will appear here as monthly revenue."
              className="border-0 bg-transparent py-10"
            />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={chartData}
                margin={{ top: 4, right: 4, left: -12, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-border"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                  className="fill-muted-foreground"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  className="fill-muted-foreground"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `$${v / 100}`}
                />
                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
                />
                <Legend
                  iconType="square"
                  iconSize={10}
                  wrapperStyle={{ fontSize: 11 }}
                />
                <Bar
                  dataKey="Cleaning Fees"
                  stackId="earned"
                  fill="hsl(217, 91%, 60%)"
                  radius={[0, 0, 0, 0]}
                  activeBar={false}
                />
                <Bar
                  dataKey="Pet Fees"
                  stackId="earned"
                  fill="hsl(45, 93%, 47%)"
                  radius={[4, 4, 0, 0]}
                  activeBar={false}
                />
                <Bar
                  dataKey="Projected Cleaning"
                  stackId="projected"
                  fill="hsl(217, 91%, 60%)"
                  fillOpacity={0.35}
                  radius={[0, 0, 0, 0]}
                  activeBar={false}
                />
                <Bar
                  dataKey="Projected Pet Fees"
                  stackId="projected"
                  fill="hsl(45, 93%, 47%)"
                  fillOpacity={0.35}
                  radius={[4, 4, 0, 0]}
                  activeBar={false}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Revenue by property */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">By Property</CardTitle>
        </CardHeader>
        <CardContent>
          {byProperty.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No cleaning data yet"
              description="Revenue by property shows up once cleanings are logged."
              className="border-0 bg-transparent py-10"
            />
          ) : (
            <div className="space-y-3">
              {byProperty.map((p) => (
                <div
                  key={p.name}
                  className="flex items-center justify-between gap-4 py-2 border-b last:border-0"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.cleanings} cleaning{p.cleanings !== 1 ? "s" : ""}
                      {p.petFeeRevenue > 0 && (
                        <span className="text-warning">
                          {" "}
                          &middot; {formatCents(p.petFeeRevenue)} pet fees
                        </span>
                      )}
                      {p.futureCleanings > 0 && (
                        <span className="text-info">
                          {" "}
                          &middot; {p.futureCleanings} upcoming
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm whitespace-nowrap">
                      {formatCents(p.totalRevenue)}
                    </p>
                    {p.futureRevenue > 0 && (
                      <p className="text-[11px] text-info whitespace-nowrap">
                        +{formatCents(p.futureRevenue)} projected
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
