"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CalendarClock,
  DollarSign,
  ClipboardList,
  TrendingUp,
} from "lucide-react";
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
};

type PropertyData = {
  name: string;
  cleanings: number;
  cleaningRevenue: number;
  petFeeRevenue: number;
  totalRevenue: number;
};

function formatCents(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatMonthLabel(month: string) {
  const [year, m] = month.split("-");
  const date = new Date(Number(year), Number(m) - 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-md text-sm">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((entry) => (
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

export function AnalyticsDashboard({
  upcomingCleanings,
  openBalance,
  monthlyRevenue,
  byProperty,
}: {
  upcomingCleanings: number;
  openBalance: number;
  monthlyRevenue: MonthData[];
  byProperty: PropertyData[];
}) {
  const totalRevenue = byProperty.reduce((sum, p) => sum + p.totalRevenue, 0);
  const totalCleanings = byProperty.reduce((sum, p) => sum + p.cleanings, 0);

  const chartData = monthlyRevenue.map((m) => ({
    name: formatMonthLabel(m.month),
    "Cleaning Fees": m.cleaningRevenue,
    "Pet Fees": m.petFeeRevenue,
  }));

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold">Analytics</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/cleaner">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-amber-100 dark:bg-amber-950/30 p-2">
                  <CalendarClock className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{upcomingCleanings}</p>
                  <p className="text-xs text-muted-foreground">
                    Upcoming Cleanings
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/cleaner/invoices">
          <Card className={`hover:border-primary/50 transition-colors cursor-pointer ${openBalance > 0 ? "border-green-300 dark:border-green-800" : ""}`}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-green-100 dark:bg-green-950/30 p-2">
                  <DollarSign className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCents(openBalance)}
                  </p>
                  <p className="text-xs text-muted-foreground">Open Balance</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-blue-100 dark:bg-blue-950/30 p-2">
                <ClipboardList className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalCleanings}</p>
                <p className="text-xs text-muted-foreground">
                  Total Cleanings
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-purple-100 dark:bg-purple-950/30 p-2">
                <TrendingUp className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {formatCents(totalRevenue)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Lifetime Revenue
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Monthly Revenue
          </CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.every(
            (d) => d["Cleaning Fees"] === 0 && d["Pet Fees"] === 0
          ) ? (
            <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
              No revenue data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
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
                  wrapperStyle={{ fontSize: 12 }}
                />
                <Bar
                  dataKey="Cleaning Fees"
                  stackId="revenue"
                  fill="hsl(217, 91%, 60%)"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="Pet Fees"
                  stackId="revenue"
                  fill="hsl(45, 93%, 47%)"
                  radius={[4, 4, 0, 0]}
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
            <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
              No cleaning data yet
            </div>
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
                        <span className="text-amber-600">
                          {" "}
                          &middot; {formatCents(p.petFeeRevenue)} pet fees
                        </span>
                      )}
                    </p>
                  </div>
                  <p className="font-semibold text-sm whitespace-nowrap">
                    {formatCents(p.totalRevenue)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
