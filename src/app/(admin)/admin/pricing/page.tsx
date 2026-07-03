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
        const reason = json.errors?.[0]?.reason || json.error || "Snapshot failed";
        toast.error(reason);
      } else {
        toast.success(`Snapshot done — ${json.results?.[0]?.rows ?? 0} nights compared.`);
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
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Save failed");
      }
      toast.success("Configuration saved");
      await loadHouse(nickname);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function setMode(mode: PricingConfig["mode"]) {
    await saveConfig({ mode });
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
        <PageHeader title="Pricing Lab" description="In-house dynamic pricing — shadow comparison against PriceLabs." />
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
        description="Our engine vs PriceLabs, side by side. Nothing is pushed to Lodgify during the shadow phase."
        actions={
          <Button onClick={runSnapshot} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Run snapshot
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
                onClick={() => setMode(m)}
                disabled={saving || m === "live"}
                title={m === "live" ? "Live push is disabled until the shadow phase is approved" : undefined}
              >
                {m}
              </Button>
            ))}
          </div>
        )}
        {data?.latest_snapshot_date && (
          <Badge variant="secondary">Last snapshot {fmtDate(data.latest_snapshot_date)}</Badge>
        )}
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            icon={Scale}
            value={summary.meanAbsPct != null ? `${summary.meanAbsPct}%` : "—"}
            label="Mean gap vs PriceLabs"
            hint={summary.count ? `${summary.count} nights compared` : "no PriceLabs data"}
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

      <Tabs defaultValue="compare">
        <TabsList>
          <TabsTrigger value="compare">Compare</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="comps">Comps</TabsTrigger>
        </TabsList>

        <TabsContent value="compare" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Nightly price — next 120 days</CardTitle>
            </CardHeader>
            <CardContent>
              <ComparisonChart snapshot={data?.snapshot ?? []} />
            </CardContent>
          </Card>
          {data && data.divergence.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Divergence over time</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Mean absolute gap between our price and PriceLabs, per snapshot day (next 90 stay dates).
                </p>
              </CardHeader>
              <CardContent>
                <DivergenceTrend points={data.divergence} />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="calendar">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Per-night detail</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <CalendarTable data={data} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config">
          {config && <ConfigEditor config={config} onSave={saveConfig} saving={saving} />}
        </TabsContent>

        <TabsContent value="comps">
          {data && (
            <CompsPanel nickname={data.config.nickname} comps={data.comps} onChanged={() => loadHouse(nickname)} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DivergenceTrend({ points }: { points: PricingLabData["divergence"] }) {
  const max = Math.max(...points.map((p) => p.mean_abs_pct), 1);
  return (
    <div className="space-y-1">
      {points.map((p) => (
        <div key={p.snapshot_date} className="flex items-center gap-3 text-sm">
          <span className="w-16 shrink-0 text-muted-foreground">{fmtDate(p.snapshot_date)}</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{ width: `${(p.mean_abs_pct / max) * 100}%`, background: "var(--series-ours)" }}
            />
          </div>
          <span className="w-14 shrink-0 text-right font-medium">{p.mean_abs_pct}%</span>
        </div>
      ))}
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
                  {delta == null ? "—" : (delta >= 0 ? "+" : "") + fmtUsd(Math.abs(delta)).replace("$", delta < 0 ? "-$" : "$")}
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
