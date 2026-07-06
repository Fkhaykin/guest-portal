"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Loader2, RefreshCw, Scale, DollarSign, Percent, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { CalendarView } from "./calendar-view";
import { ConfigureRail, MetricsRail } from "./calendar-sidebars";
import { CustomizationsModal } from "./customizations-modal";
import { NeighborhoodChart } from "./neighborhood-chart";
import { CompetitorMap } from "./competitor-map";
import { CompetitorCalendar } from "./competitor-calendar";
import { AlgorithmTab } from "./algorithm-tab";
import { ComparisonChart, summarizeSnapshot } from "./comparison-chart";
import { ConfigEditor } from "./config-editor";
import { CompsPanel } from "./comps-panel";
import type { PricingConfig, PricingLabData } from "./types";
import { fmtUsd, fmtDate, timeAgo, daysSince, hoaLabel } from "./types";

export default function PricingLabPage() {
  const [configs, setConfigs] = useState<PricingConfig[]>([]);
  const [nickname, setNickname] = useState<string>("");
  const [hoaFilter, setHoaFilter] = useState<string | null>(null);
  const [data, setData] = useState<PricingLabData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  // Customizations modal: null = closed; "" = open at default page; a rule key
  // = open at that page. Lifted here so both rails can open it.
  const [custKey, setCustKey] = useState<string | null>(null);
  // Monotonic counter so a slow response for a previously-selected house can
  // never land under the current selection.
  const loadSeq = useRef(0);

  const loadConfigs = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/admin/pricing-lab");
      if (!res.ok) throw new Error("Failed to load houses");
      const json = await res.json();
      const list: PricingConfig[] = json.configs ?? [];
      setConfigs(list);
      if (list.length) setNickname((n) => n || list[0].nickname);
      if (!list.length) setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  const loadHouse = useCallback(async (nick: string) => {
    if (!nick) return;
    const seq = ++loadSeq.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/pricing-lab?nickname=${encodeURIComponent(nick)}`);
      const json = await res.json();
      if (seq !== loadSeq.current) return; // a newer load superseded this one
      if (!res.ok) throw new Error(json.error || "Failed to load pricing data");
      setData(json);
    } catch (err) {
      if (seq !== loadSeq.current) return;
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Snapshot failed");
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

  if (error && !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Pricing Lab" description="In-house dynamic pricing." />
        <EmptyState
          icon={AlertTriangle}
          title="Couldn't load pricing data"
          description={error}
          action={
            <Button onClick={() => (nickname ? loadHouse(nickname) : loadConfigs())}>
              <RefreshCw className="h-4 w-4" /> Retry
            </Button>
          }
        />
      </div>
    );
  }

  if (loading && !data) return <PricingSkeleton />;

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

  // HOA filter for the house list (e.g. Penn Estates vs Big Bass Lake).
  const hoaTypes = [...new Set(configs.map((c) => c.hoa_type).filter((t): t is string => !!t))];
  const visibleConfigs = hoaFilter ? configs.filter((c) => c.hoa_type === hoaFilter) : configs;

  function applyHoaFilter(type: string | null) {
    setHoaFilter(type);
    const next = type ? configs.filter((c) => c.hoa_type === type) : configs;
    if (next.length && !next.some((c) => c.nickname === nickname)) setNickname(next[0].nickname);
  }

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

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {hoaTypes.length > 1 && (
          <div className="flex items-center overflow-hidden rounded-md border border-border">
            <button
              onClick={() => applyHoaFilter(null)}
              className={`px-2.5 py-1.5 text-xs ${hoaFilter === null ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              All HOAs
            </button>
            {hoaTypes.map((t) => (
              <button
                key={t}
                onClick={() => applyHoaFilter(t)}
                className={`border-l border-border px-2.5 py-1.5 text-xs ${hoaFilter === t ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                {hoaLabel(t)}
              </button>
            ))}
          </div>
        )}
        <Select value={nickname} onValueChange={(v) => v && setNickname(v)}>
          <SelectTrigger
            className="h-auto w-72 overflow-hidden py-1.5"
            title={data?.meta?.address ?? undefined}
          >
            <div className="min-w-0 text-left">
              <div className="truncate font-semibold">{data?.meta?.name ?? nickname}</div>
              {data?.meta && (
                <div className="truncate text-xs text-muted-foreground">
                  {[
                    data.meta.maxGuests ? `Sleeps ${data.meta.maxGuests}` : null,
                    shortLocation(data.meta.address),
                    data.meta.lodgifyId ? `Lodgify ${data.meta.lodgifyId}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              )}
            </div>
          </SelectTrigger>
          <SelectContent>
            {visibleConfigs.map((c) => (
              <SelectItem key={c.id} value={c.nickname}>
                {c.nickname}
                {c.hoa_type && <span className="ml-2 text-xs text-muted-foreground">{hoaLabel(c.hoa_type)}</span>}
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
        <FreshnessChips data={data} />
        {loading && data && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      <Tabs
        defaultValue="calendar"
        className={loading && data ? "pointer-events-none opacity-60 transition-opacity" : "transition-opacity"}
      >
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
              <ConfigureRail
                key={config.id}
                config={config}
                data={data}
                onSave={saveConfig}
                onEdit={() => setCustKey("")}
                saving={saving}
              />
              <CalendarView
                config={config}
                snapshot={data.snapshot}
                market={data.market}
                bookings={data.bookings}
                blocks={data.blocks}
                weather={data.weather}
                today={data.today}
              />
              <MetricsRail data={data} onEditRule={(k) => setCustKey(k)} />
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
          {data && config && <NeighborhoodChart config={config} snapshot={data.snapshot} market={data.market} />}
          {data && <CompetitorMap comps={data.comps} house={data.house} />}
          {data && <CompetitorCalendar nickname={data.config.nickname} />}
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

      {config && data && (
        <CustomizationsModal
          open={custKey !== null}
          onOpenChange={(o) => setCustKey(o ? custKey ?? "" : null)}
          config={config}
          data={data}
          initialKey={custKey || undefined}
          onSave={saveConfig}
          saving={saving}
        />
      )}
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

function PricingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-9 w-40" />
      </div>
      <Skeleton className="h-9 w-full max-w-xl" />
      <div className="grid gap-4 lg:grid-cols-[240px_1fr_220px]">
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
        <Skeleton className="h-130 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  );
}

// Pull the town out of a full "Street, Number, City, State, Zip" address so the
// house switcher stays compact (full address is on the trigger's title tooltip).
function shortLocation(address: string | null): string | null {
  if (!address) return null;
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  const dropRe = /^(\d+|\d{5}(-\d{4})?|[A-Z]{2}(\s+\d{5}(-\d{4})?)?|pennsylvania|new york|new jersey)$/i;
  const cleaned = parts.filter((p) => !dropRe.test(p));
  return cleaned.length ? cleaned[cleaned.length - 1] : null;
}

function FreshnessChips({ data }: { data: PricingLabData | null }) {
  if (!data) return null;
  const priceStale = daysSince(data.latest_snapshot_date);
  const pulseStale = daysSince(data.pulse_date);
  const chip = (label: string, stale: boolean, title: string) => (
    <Badge
      variant="secondary"
      title={title}
      className={stale ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : ""}
    >
      {stale && <AlertTriangle className="mr-1 h-3 w-3" />}
      {label}
    </Badge>
  );
  return (
    <div className="flex items-center gap-2">
      {data.latest_snapshot_at &&
        chip(
          `Prices ${timeAgo(data.latest_snapshot_at)}`,
          priceStale != null && priceStale > 1,
          "When the engine last recomputed prices"
        )}
      {data.pulse_date &&
        chip(
          `Market ${pulseStale === 0 ? "today" : `${pulseStale}d ago`}`,
          pulseStale != null && pulseStale > 2,
          "When the comp-set market signal was last aggregated"
        )}
    </div>
  );
}
