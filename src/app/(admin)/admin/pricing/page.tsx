"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, RefreshCw, Scale, DollarSign, Percent } from "lucide-react";
import { toast } from "sonner";
import { CalendarView } from "./calendar-view";
import { ConfigureRail, MetricsRail } from "./calendar-sidebars";
import { NeighborhoodChart } from "./neighborhood-chart";
import { CompetitorMap } from "./competitor-map";
import { AlgorithmTab } from "./algorithm-tab";
import { ComparisonChart, summarizeSnapshot } from "./comparison-chart";
import { ConfigEditor } from "./config-editor";
import { CompsPanel } from "./comps-panel";
import type { PricingConfig, PricingLabData } from "./types";
import { fmtUsd, fmtDate } from "./types";

export default function PricingLabPage() {
  const [configs, setConfigs] = useState<PricingConfig[]>([]);
  const [nickname, setNickname] = useState<string>("");
  const [data, setData] = useState<PricingLabData | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/pricing-lab");
      const json = await res.json();
      const list: PricingConfig[] = json.configs ?? [];
      setConfigs(list);
      if (list.length) setNickname(list[0].nickname);
      setLoading(false);
    })();
  }, []);

  const loadHouse = useCallback(async (nick: string) => {
    if (!nick) return;
    setLoading(true);
    const res = await fetch(`/api/admin/pricing-lab?nickname=${encodeURIComponent(nick)}`);
    const json = await res.json();
    if (res.ok) setData(json);
    else toast.error(json.error || "Failed to load");
    setLoading(false);
  }, []);

  useEffect(() => {
    if (nickname) loadHouse(nickname);
  }, [nickname, loadHouse]);

  const summary = useMemo(() => (data ? summarizeSnapshot(data.snapshot) : null), [data]);

  async function runSnapshot() {
    setRunning(true);
    try {
      const res = await fetch("/api/admin/pricing-lab/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        toast.error(json.errors?.[0]?.reason || json.error || "Snapshot failed");
      } else {
        toast.success(`Refreshed — ${json.results?.[0]?.rows ?? 0} nights computed.`);
        await loadHouse(nickname);
      }
    } finally {
      setRunning(false);
    }
  }

  async function saveConfig(patch: Partial<PricingConfig>) {
    if (!data) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/pricing-lab", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: data.config.id, ...patch }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Save failed");
      // Re-run the engine so the calendar reflects the new config immediately.
      await fetch("/api/admin/pricing-lab/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname }),
      });
      toast.success("Saved & refreshed");
      await loadHouse(nickname);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (configs.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Pricing Lab" description="In-house dynamic pricing." />
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No houses configured yet. Seed <code>pricing_config</code> to begin.
          </CardContent>
        </Card>
      </div>
    );
  }

  const config = data?.config;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pricing Lab"
        description="Dynamic nightly pricing for your houses — calendar, neighborhood data, and configuration."
        actions={
          <Button onClick={runSnapshot} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sync now
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Select value={nickname} onValueChange={(v) => v && setNickname(v)}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {configs.map((c) => (
              <SelectItem key={c.id} value={c.nickname}>
                {c.nickname}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {config && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Mode:</span>
            {(["off", "shadow", "live"] as const).map((m) => (
              <Button
                key={m}
                size="sm"
                variant={config.mode === m ? "default" : "outline"}
                onClick={() => saveConfig({ mode: m })}
                disabled={saving || m === "live"}
                title={m === "live" ? "Live push to Lodgify is disabled during the shadow evaluation" : undefined}
              >
                {m}
              </Button>
            ))}
          </div>
        )}
        {data?.latest_snapshot_date && (
          <Badge variant="secondary">Refreshed {fmtDate(data.latest_snapshot_date)}</Badge>
        )}
      </div>

      <Tabs defaultValue="calendar">
        <TabsList>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="algorithm">Algorithm</TabsTrigger>
          <TabsTrigger value="neighborhood">Neighborhood Data</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="comps">Comps</TabsTrigger>
          <TabsTrigger value="validation">PriceLabs check</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar">
          {config && data && (
            <div className="grid gap-4 lg:grid-cols-[240px_1fr_220px]">
              <ConfigureRail config={config} onSave={saveConfig} saving={saving} />
              <CalendarView config={config} snapshot={data.snapshot} market={data.market} today={data.today} />
              <MetricsRail metrics={data.metrics} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="algorithm">
          {data && (
            <AlgorithmTab
              data={data}
              lakefront={data.comps.some((c) => c.is_self && c.is_lakefront)}
            />
          )}
        </TabsContent>

        <TabsContent value="neighborhood" className="space-y-4">
          {data && <NeighborhoodChart snapshot={data.snapshot} market={data.market} />}
          {data && <CompetitorMap comps={data.comps} house={data.house} />}
        </TabsContent>

        <TabsContent value="config">
          {config && <ConfigEditor config={config} onSave={saveConfig} saving={saving} />}
        </TabsContent>

        <TabsContent value="comps">
          {data && (
            <CompsPanel nickname={data.config.nickname} comps={data.comps} onChanged={() => loadHouse(nickname)} />
          )}
        </TabsContent>

        <TabsContent value="validation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Shadow validation vs PriceLabs</CardTitle>
              <p className="text-sm text-muted-foreground">
                A month-long check that our engine tracks a sane market — not a live dependency. Both
                prices are computed daily; nothing is pushed to Lodgify.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {summary && (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <StatCard
                    icon={Scale}
                    value={summary.meanAbsPct != null ? `${summary.meanAbsPct}%` : "—"}
                    label="Mean gap vs PriceLabs"
                    hint={summary.count ? `${summary.count} nights` : "no PriceLabs data"}
                  />
                  <StatCard icon={DollarSign} value={fmtUsd(summary.ourMean)} label="Our avg nightly" tone="info" />
                  <StatCard icon={DollarSign} value={fmtUsd(summary.plMean)} label="PriceLabs avg nightly" tone="info" />
                  <StatCard
                    icon={Percent}
                    value={summary.richerPct != null ? `${summary.richerPct}%` : "—"}
                    label="Nights we price higher"
                    tone={summary.richerPct != null && summary.richerPct > 55 ? "warning" : "info"}
                  />
                </div>
              )}
              <ComparisonChart snapshot={data?.snapshot ?? []} />
              {data && data.divergence.length > 1 && <DivergenceTrend points={data.divergence} />}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Per-night detail</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <CalendarTable data={data} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DivergenceTrend({ points }: { points: PricingLabData["divergence"] }) {
  const max = Math.max(...points.map((p) => p.mean_abs_pct), 1);
  return (
    <div>
      <p className="mb-2 text-sm font-medium">Divergence over time</p>
      <div className="space-y-1">
        {points.map((p) => (
          <div key={p.snapshot_date} className="flex items-center gap-3 text-sm">
            <span className="w-16 shrink-0 text-muted-foreground">{fmtDate(p.snapshot_date)}</span>
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full" style={{ width: `${(p.mean_abs_pct / max) * 100}%`, background: "var(--series-ours)" }} />
            </div>
            <span className="w-14 shrink-0 text-right font-medium">{p.mean_abs_pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CalendarTable({ data }: { data: PricingLabData | null }) {
  const rows = (data?.snapshot ?? []).slice(0, 120);
  if (rows.length === 0) {
    return <div className="p-6 text-center text-sm text-muted-foreground">No snapshot yet.</div>;
  }
  return (
    <div className="max-h-150 overflow-auto">
      <Table>
        <TableHeader className="sticky top-0 bg-card">
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Ours</TableHead>
            <TableHead className="text-right">PriceLabs</TableHead>
            <TableHead className="text-right">Δ</TableHead>
            <TableHead className="text-center">Min stay</TableHead>
            <TableHead>Why</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const delta =
              r.our_price_cents != null && r.pl_user_price_cents != null
                ? r.our_price_cents - r.pl_user_price_cents
                : null;
            return (
              <TableRow key={r.stay_date} className={r.is_booked ? "opacity-40" : undefined}>
                <TableCell className="font-medium">
                  {fmtDate(r.stay_date)}
                  {r.is_booked && <Badge variant="secondary" className="ml-2">booked</Badge>}
                </TableCell>
                <TableCell className="text-right font-medium" style={{ color: "var(--series-ours)" }}>
                  {fmtUsd(r.our_price_cents)}
                </TableCell>
                <TableCell className="text-right" style={{ color: "var(--series-pl)" }}>
                  {fmtUsd(r.pl_user_price_cents)}
                </TableCell>
                <TableCell className="text-right">
                  {delta == null ? "—" : (delta >= 0 ? "+" : "-") + fmtUsd(Math.abs(delta))}
                </TableCell>
                <TableCell className="text-center">{r.our_min_stay ?? "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{explainFactors(r.factors)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function explainFactors(f: PricingLabData["snapshot"][number]["factors"]): string {
  if (!f) return "";
  const parts: string[] = [];
  if (f.season_pct) parts.push(`season ${f.season_pct > 0 ? "+" : ""}${f.season_pct}%`);
  if (f.dow_pct) parts.push(`dow ${f.dow_pct > 0 ? "+" : ""}${f.dow_pct}%`);
  if (f.event_pct) parts.push(`event ${f.event_pct > 0 ? "+" : ""}${f.event_pct}%`);
  if (f.discount_src === "leadtime" && f.leadtime_pct) parts.push(`lead-time ${f.leadtime_pct}%`);
  if (f.discount_src === "pace" && f.pace_pct) parts.push(`pace ${f.pace_pct}%`);
  if (f.discount_src === "gap" && f.gap_pct) parts.push(`orphan gap ${f.gap_pct}%`);
  if (f.pace_pct > 0) parts.push(`pace +${f.pace_pct}%`);
  if (f.clamped) parts.push(`clamped to ${f.clamped}`);
  if (f.override) parts.push("override");
  return parts.join(" · ");
}
