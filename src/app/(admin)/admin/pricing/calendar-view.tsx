"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Moon, CalendarDays } from "lucide-react";
import type { PricingConfig, SnapshotRow, MarketPoint, BookingNight, BlockNight } from "./types";
import { fmtUsd, fmtDate } from "./types";
import { buildLadder, demandLevel, DEMAND_COLORS, type DemandLevel } from "./breakdown";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function monthLabel(y: number, m: number): string {
  // timeZone: "UTC" — the cell dates are UTC-anchored; without it the label
  // renders the previous month for US-negative offsets (July grid says "June").
  return new Date(Date.UTC(y, m, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
function eventLabelFor(row: SnapshotRow, config: PricingConfig): string | null {
  const f = row.factors;
  if (!f || !f.event_pct) return null;
  const ev = config.rules.events?.find((e) => row.stay_date >= e.from && row.stay_date <= e.to);
  return ev?.label ?? "Event";
}

export function CalendarView({
  config,
  snapshot,
  market,
  bookings,
  blocks,
  today,
}: {
  config: PricingConfig;
  snapshot: SnapshotRow[];
  market: MarketPoint[];
  bookings: Record<string, BookingNight>;
  blocks: Record<string, BlockNight>;
  today: string;
}) {
  const firstStay = snapshot[0]?.stay_date ?? today;
  const [cursor, setCursor] = useState(() => {
    const d = new Date(firstStay + "T00:00:00Z");
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
  });

  const byDate = useMemo(() => new Map(snapshot.map((r) => [r.stay_date, r])), [snapshot]);
  const marketByDate = useMemo(() => new Map(market.map((r) => [r.stay_date, r])), [market]);

  const cells = useMemo(() => {
    const first = new Date(Date.UTC(cursor.y, cursor.m, 1));
    const startPad = first.getUTCDay();
    const daysInMonth = new Date(Date.UTC(cursor.y, cursor.m + 1, 0)).getUTCDate();
    const out: (string | null)[] = [];
    for (let i = 0; i < startPad; i++) out.push(null);
    for (let day = 1; day <= daysInMonth; day++) out.push(ymd(new Date(Date.UTC(cursor.y, cursor.m, day))));
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [cursor]);

  function shift(delta: number) {
    setCursor((c) => {
      const d = new Date(Date.UTC(c.y, c.m + delta, 1));
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
    });
  }
  function goToday() {
    const d = new Date(today + "T00:00:00Z");
    setCursor({ y: d.getUTCFullYear(), m: d.getUTCMonth() });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToday}>
            <CalendarDays className="h-4 w-4" /> Today
          </Button>
          <Button variant="ghost" size="icon" onClick={() => shift(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-40 text-center text-lg font-semibold">
            {monthLabel(cursor.y, cursor.m)}
          </span>
          <Button variant="ghost" size="icon" onClick={() => shift(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <DemandLegend />
      </div>

      <div className="grid grid-cols-7 overflow-hidden rounded-lg border border-border">
        {WEEKDAYS.map((w) => (
          <div key={w} className="border-b border-border bg-muted/40 px-2 py-1.5 text-center text-xs font-medium text-muted-foreground">
            {w}
          </div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={i} className="min-h-24 border-b border-r border-border bg-muted/20" />;
          const row = byDate.get(date);
          const mkt = marketByDate.get(date);
          return (
            <DayCell
              key={date}
              date={date}
              row={row}
              market={mkt}
              booking={bookings[date]}
              block={blocks[date]}
              config={config}
              today={today}
              isLastCol={(i + 1) % 7 === 0}
            />
          );
        })}
      </div>
    </div>
  );
}

function DayCell({
  date,
  row,
  market,
  booking,
  block,
  config,
  today,
  isLastCol,
}: {
  date: string;
  row: SnapshotRow | undefined;
  market: MarketPoint | undefined;
  booking: BookingNight | undefined;
  block: BlockNight | undefined;
  config: PricingConfig;
  today: string;
  isLastCol: boolean;
}) {
  const dayNum = parseInt(date.slice(8, 10), 10);
  const isPast = date < today;
  const demand = row ? demandLevel(row, market) : ({ key: "none", label: "", occPct: null } as DemandLevel);
  const isBlocked = !!block;
  const booked = !!row?.is_booked;
  const baseBg = isBlocked
    ? "var(--demand-unavailable)"
    : row && !isPast
      ? DEMAND_COLORS[demand.key]
      : "transparent";
  // Booked = diagonal strike; blocked = denser hatch, so the two read apart.
  const strike = "linear-gradient(to top right, transparent calc(50% - 0.5px), var(--color-border) calc(50% - 0.5px), var(--color-border) calc(50% + 0.5px), transparent calc(50% + 0.5px))";
  const hatch = "repeating-linear-gradient(-45deg, transparent 0 5px, var(--color-border) 5px 6px)";
  const bg = isBlocked ? `${hatch}, ${baseBg}` : booked ? `${strike}, ${baseBg}` : baseBg;
  const eventLabel = row ? eventLabelFor(row, config) : null;
  const clickable = !!row && !isPast;

  const className = [
    "relative min-h-24 border-b border-r border-border p-1.5 text-left transition-colors",
    isLastCol ? "border-r-0" : "",
    isPast ? "opacity-40" : "",
    clickable ? "cursor-pointer hover:ring-2 hover:ring-primary/40 hover:ring-inset" : "",
  ].join(" ");

  const inner = (
    <>
      {/* Check-in corner wedge */}
      {booking?.is_check_in && (
        <div
          className="absolute left-0 top-0 h-0 w-0"
          style={{ borderTop: "12px solid var(--series-ours)", borderRight: "12px solid transparent" }}
          title="Guest check-in"
        />
      )}
      <div className="flex items-start justify-between">
        <span className="flex items-center gap-0.5 pl-2 text-[11px] font-medium text-muted-foreground">
          {!isBlocked && !booked && row?.our_min_stay ? (
            <>
              <Moon className="h-3 w-3" />
              {row.our_min_stay}
            </>
          ) : null}
        </span>
        <span className="text-xs font-semibold text-muted-foreground">{dayNum}</span>
      </div>
      {eventLabel && !booked && !isBlocked && (
        <div className="mt-0.5 truncate rounded bg-violet-500/15 px-1 text-[10px] font-medium text-violet-700 dark:text-violet-300">
          {eventLabel}
        </div>
      )}
      {isBlocked ? (
        <div className="absolute bottom-1.5 left-1.5 text-xs font-medium text-muted-foreground">Blocked</div>
      ) : booked ? (
        <div className="absolute bottom-1 left-1.5 leading-tight">
          <div className="text-xs font-medium text-muted-foreground">Booked</div>
          {booking?.adr_cents != null && (
            <div className="text-[11px] tabular-nums text-muted-foreground">ADR {fmtUsd(booking.adr_cents)}</div>
          )}
        </div>
      ) : row?.our_price_cents != null ? (
        <div className="absolute bottom-1 left-0 right-0 text-center text-base font-bold tabular-nums">
          {fmtUsd(row.our_price_cents)}
        </div>
      ) : null}
    </>
  );

  if (!clickable || !row) {
    return (
      <div className={className} style={{ background: bg }}>
        {inner}
      </div>
    );
  }

  return (
    <Popover>
      <PopoverTrigger render={<div />} className={className} style={{ background: bg }}>
        {inner}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="center">
        <BreakdownCard date={date} row={row} market={market} booking={booking} block={block} config={config} today={today} demand={demand} />
      </PopoverContent>
    </Popover>
  );
}

function BreakdownCard({
  date,
  row,
  market,
  booking,
  block,
  config,
  today,
  demand,
}: {
  date: string;
  row: SnapshotRow;
  market: MarketPoint | undefined;
  booking: BookingNight | undefined;
  block: BlockNight | undefined;
  config: PricingConfig;
  today: string;
  demand: DemandLevel;
}) {
  const dateLabelTop = new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  // Occupied nights show a booking/block summary, not a hypothetical ladder.
  if (booking || block) {
    return (
      <div className="p-3 text-sm">
        <div className="mb-2 font-semibold">{dateLabelTop}</div>
        {booking ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium">Booked{booking.source ? ` · ${booking.source}` : ""}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Stay</span>
              <span>{fmtDate(booking.check_in)} → {fmtDate(booking.check_out)}</span>
            </div>
            {booking.adr_cents != null && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Nightly (ADR)</span>
                <span className="font-medium tabular-nums">{fmtUsd(booking.adr_cents)}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium">Blocked</span>
            </div>
            {block?.reason && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Reason</span>
                <span>{block.reason}</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  const ladder = buildLadder(row, config);
  const nightsAway = Math.round(
    (new Date(date + "T00:00:00Z").getTime() - new Date(today + "T00:00:00Z").getTime()) / 86_400_000
  );
  const eventLabel = eventLabelFor(row, config);
  const dateLabel = new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="text-sm">
      <div className="space-y-1 border-b border-border p-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{dateLabel}</span>
          <span className="text-xs text-muted-foreground">{nightsAway}N away</span>
          {eventLabel && (
            <Badge variant="secondary" className="ml-auto text-[10px]">
              {eventLabel}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ background: DEMAND_COLORS[demand.key] }}
          />
          {demand.label}
          {demand.occPct != null && ` (${demand.occPct}% market occupancy)`}
          {market?.p50 != null && ` · market median ${fmtUsd(market.p50)}`}
        </div>
      </div>

      <div className="divide-y divide-border">
        {ladder.map((r, i) => {
          if (r.kind === "section") {
            return (
              <div key={i} className="bg-muted/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {r.label}
              </div>
            );
          }
          const isTotal = r.kind === "total";
          return (
            <div key={i} className={`flex items-center justify-between px-3 py-1.5 ${isTotal ? "font-semibold" : ""}`}>
              <span className={isTotal ? "" : "text-muted-foreground"}>{r.label}</span>
              <span className="flex items-center gap-2 tabular-nums">
                {r.pct != null && (
                  <span className={r.pct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                    {r.pct >= 0 ? "+" : ""}
                    {r.pct}%
                  </span>
                )}
                {r.runningCents != null && <span>{fmtUsd(r.runningCents)}</span>}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground">
        <span>Minimum stay</span>
        <span className="font-medium text-foreground">{row.our_min_stay ?? "—"} nights</span>
      </div>
    </div>
  );
}

function DemandLegend() {
  const items: { key: DemandLevel["key"]; label: string }[] = [
    { key: "low", label: "Low" },
    { key: "normal", label: "Normal" },
    { key: "good", label: "Good" },
    { key: "high", label: "High" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      {items.map((it) => (
        <span key={it.key} className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm border border-border" style={{ background: DEMAND_COLORS[it.key] }} />
          {it.label}
        </span>
      ))}
      <span className="flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded-sm border border-border" style={{ background: `linear-gradient(to top right, transparent 45%, var(--color-border) 45% 55%, transparent 55%), var(--demand-unavailable)` }} /> Booked
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded-sm border border-border" style={{ background: `repeating-linear-gradient(-45deg, transparent 0 2px, var(--color-border) 2px 3px), var(--demand-unavailable)` }} /> Blocked
      </span>
      <span className="flex items-center gap-1">
        <Moon className="h-3 w-3" /> Min-stay
      </span>
    </div>
  );
}
