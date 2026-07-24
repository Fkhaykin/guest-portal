"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { HOUSE_LABELS } from "@/lib/guest-messages/quick-replies";
import { NEAR_MISS_PERCENT, type OutcomeSummary } from "@/lib/guest-messages/outcome";
import { Bot, CheckCheck, Sparkles, Zap } from "lucide-react";

// recharts is heavy — keep it out of the settings-page bundle until this panel renders.
const AiEffectivenessChart = dynamic(
  () => import("./ai-effectiveness-chart").then((m) => m.AiEffectivenessChart),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full rounded-xl" /> }
);

const RANGES = [
  { days: 7, label: "7d" },
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
] as const;

/**
 * AI draft effectiveness: how often the host accepts an AI-suggested reply as-is
 * vs. edits or discards it, plotted over time. We watch this trend to decide
 * when drafts are trustworthy enough to send automatically.
 */
export function AiEffectiveness() {
  const [days, setDays] = useState<number>(30);
  const [summary, setSummary] = useState<OutcomeSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (range: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/messages/outcome?days=${range}`);
      const data = await res.json();
      if (res.ok) setSummary(data.summary as OutcomeSummary);
    } catch {
      // leave the last-loaded summary in place
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(days);
  }, [days, load]);

  const t = summary?.totals;
  const hasData = !!t && t.total > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI reply effectiveness
            </CardTitle>
            <CardDescription>
              How often AI-drafted replies are sent as-is vs. edited or discarded.
              Tracked until drafts are reliable enough to automate.
            </CardDescription>
          </div>
          <div className="flex shrink-0 rounded-md border p-0.5">
            {RANGES.map((r) => (
              <Button
                key={r.days}
                size="sm"
                variant={days === r.days ? "secondary" : "ghost"}
                className="h-7 px-2.5 text-xs"
                onClick={() => setDays(r.days)}
              >
                {r.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && !summary ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[76px] rounded-xl" />
            ))}
          </div>
        ) : !hasData ? (
          <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
            No AI drafts have been acted on in the last {days} days yet.
            <div className="mt-1 text-xs">
              Send, edit, or discard a suggested reply and the numbers will show up here.
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                icon={CheckCheck}
                value={`${t.acceptanceRate}%`}
                label="Accepted as-is"
                hint={`${t.accepted} of ${t.total} drafts`}
              />
              <StatCard
                icon={Sparkles}
                value={`${t.sentAcceptanceRate}%`}
                label="Sent unedited"
                hint={`${t.accepted} of ${t.sent} sent`}
              />
              <StatCard
                icon={Zap}
                value={`${t.autoReadyRate}%`}
                label="Auto-ready"
                hint={`accepted or ≤${NEAR_MISS_PERCENT}% edited`}
              />
              <StatCard
                icon={Bot}
                value={t.total}
                label="Drafts acted on"
                hint={`${t.discarded} discarded`}
              />
            </div>

            {/* Outcome breakdown */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>
                <span className="font-medium text-foreground">{t.accepted}</span> accepted
              </span>
              <span>
                <span className="font-medium text-foreground">{t.edited}</span> edited
                {summary?.medianEditPercent != null && ` (median ${summary.medianEditPercent}% changed)`}
              </span>
              <span>
                <span className="font-medium text-foreground">{t.discarded}</span> discarded
              </span>
            </div>

            {summary && summary.daily.length > 1 ? (
              <AiEffectivenessChart data={summary.daily} />
            ) : (
              <p className="text-xs text-muted-foreground">
                Trend chart appears once there are at least two active days.
              </p>
            )}

            {summary && summary.byHouse.length > 0 && (
              <div className="border-t pt-3">
                <div className="mb-1.5 text-xs font-medium text-muted-foreground">
                  Acceptance by house
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  {summary.byHouse.map((h) => (
                    <span key={h.house}>
                      {HOUSE_LABELS[h.house as keyof typeof HOUSE_LABELS] ?? h.house}:{" "}
                      <span className="font-medium">{h.acceptanceRate}%</span>
                      <span className="text-muted-foreground"> ({h.total})</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
