"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ChevronLeft,
  ChevronRight,
  Users,
  CalendarDays,
  Sparkles,
  User,
  Baby,
  PawPrint,
  Home,
} from "lucide-react";
import type { GuestListEntry, PetEntry } from "@/types/database";

export type CalendarReservation = {
  id: string;
  propertyName: string;
  propertyCoverImage: string | null;
  propertyColor: string;
  checkIn: string;
  checkOut: string;
  numGuests: number;
  guestList: GuestListEntry[] | null;
  pets: PetEntry[] | null;
  isCleaned: boolean;
  upsellCount: number;
  upsellLabels: string[];
};

const DAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(d: Date, n: number) {
  const result = new Date(d);
  result.setDate(result.getDate() + n);
  return result;
}

function formatDateLong(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

const VISIBLE_DAYS = 14;

export function CalendarView({
  reservations,
}: {
  reservations: CalendarReservation[];
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Start from beginning of current week (Sunday)
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());

  const [startDate, setStartDate] = useState(startOfWeek);
  const [selected, setSelected] = useState<CalendarReservation | null>(null);

  const todayStr = toDateStr(today);

  // Build array of visible day strings
  const days: { date: Date; str: string }[] = [];
  for (let i = 0; i < VISIBLE_DAYS; i++) {
    const d = addDays(startDate, i);
    days.push({ date: d, str: toDateStr(d) });
  }

  const rangeStart = days[0].str;
  const rangeEnd = days[days.length - 1].str;

  // Build header label (e.g. "Apr 6 – Apr 19, 2026")
  const headerStart = days[0].date;
  const headerEnd = days[days.length - 1].date;
  const sameMonth = headerStart.getMonth() === headerEnd.getMonth();
  const headerLabel = sameMonth
    ? `${MONTH_NAMES_SHORT[headerStart.getMonth()]} ${headerStart.getDate()} – ${headerEnd.getDate()}, ${headerEnd.getFullYear()}`
    : `${MONTH_NAMES_SHORT[headerStart.getMonth()]} ${headerStart.getDate()} – ${MONTH_NAMES_SHORT[headerEnd.getMonth()]} ${headerEnd.getDate()}, ${headerEnd.getFullYear()}`;

  // Group reservations by property, only those overlapping the visible range
  const byProperty = new Map<
    string,
    { color: string; coverImage: string | null; reservations: CalendarReservation[] }
  >();
  for (const r of reservations) {
    if (r.checkOut <= rangeStart || r.checkIn > rangeEnd) continue;
    if (!byProperty.has(r.propertyName)) {
      byProperty.set(r.propertyName, {
        color: r.propertyColor,
        coverImage: r.propertyCoverImage,
        reservations: [],
      });
    }
    byProperty.get(r.propertyName)!.reservations.push(r);
  }

  const properties = [...byProperty.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  function prevPeriod() {
    setStartDate(addDays(startDate, -VISIBLE_DAYS));
  }
  function nextPeriod() {
    setStartDate(addDays(startDate, VISIBLE_DAYS));
  }
  function goToday() {
    const sw = new Date(today);
    sw.setDate(today.getDate() - today.getDay());
    setStartDate(sw);
  }

  // For a reservation, get its column start and span within the visible range
  function getBarPosition(r: CalendarReservation) {
    // Find first visible day >= checkIn
    let startIdx = 0;
    let isClampedStart = true;
    for (let i = 0; i < days.length; i++) {
      if (days[i].str >= r.checkIn) {
        startIdx = i;
        isClampedStart = days[i].str !== r.checkIn;
        break;
      }
    }

    // Find last visible day < checkOut (last occupied night)
    // But we want the bar to bleed into checkout day
    let endIdx = days.length - 1;
    let isClampedEnd = true;
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].str <= r.checkOut) {
        endIdx = i;
        isClampedEnd = days[i].str !== r.checkOut;
        break;
      }
    }

    // If checkOut is beyond visible range
    if (r.checkOut > rangeEnd) {
      endIdx = days.length - 1;
      isClampedEnd = false;
    }

    return { startIdx, endIdx, isClampedStart, isClampedEnd };
  }

  return (
    <>
      <Card className="p-4">
        {/* Navigation */}
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="icon" onClick={prevPeriod}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center">
            <h3 className="font-semibold text-sm">{headerLabel}</h3>
            <button onClick={goToday} className="text-[10px] text-primary hover:underline">
              Today
            </button>
          </div>
          <Button variant="ghost" size="icon" onClick={nextPeriod}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Day headers */}
        <div
          className="grid gap-0 border-b pb-2 mb-2"
          style={{ gridTemplateColumns: `140px repeat(${VISIBLE_DAYS}, 1fr)` }}
        >
          <div />
          {days.map(({ date, str }) => {
            const isToday = str === todayStr;
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            return (
              <div
                key={str}
                className={`text-center leading-tight ${
                  isToday ? "font-bold text-primary" : isWeekend ? "text-muted-foreground/50" : "text-muted-foreground"
                }`}
              >
                <div className="text-[10px]">{DAY_NAMES_SHORT[date.getDay()]}</div>
                <div
                  className={`text-xs ${
                    isToday
                      ? "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center mx-auto"
                      : ""
                  }`}
                >
                  {date.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Property rows */}
        {properties.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No reservations in this period.
          </p>
        ) : (
          <div className="space-y-2">
            {properties.map(([propName, { color, coverImage, reservations: propRes }]) => (
              <div key={propName}>
                {/* Property label row */}
                <div
                  className="grid gap-0 items-center"
                  style={{ gridTemplateColumns: `140px repeat(${VISIBLE_DAYS}, 1fr)` }}
                >
                  <div className="flex items-center gap-2 pr-2 min-w-0">
                    <div className="h-7 w-7 rounded overflow-hidden shrink-0">
                      {coverImage ? (
                        <img src={coverImage} alt={propName} className="w-full h-full object-cover" />
                      ) : (
                        <div className={`w-full h-full ${color} opacity-20 flex items-center justify-center`}>
                          <Home className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <span className="text-[11px] font-medium truncate">{propName}</span>
                  </div>

                  {/* Day cells (background grid lines) */}
                  {days.map(({ str, date }) => {
                    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                    return (
                      <div
                        key={str}
                        className={`h-9 border-l ${
                          isWeekend ? "bg-muted/20 border-muted/20" : "border-muted/15"
                        }`}
                      />
                    );
                  })}
                </div>

                {/* Reservation bars (overlaid on the row) */}
                <div
                  className="grid gap-0 -mt-9"
                  style={{ gridTemplateColumns: `140px repeat(${VISIBLE_DAYS}, 1fr)` }}
                >
                  <div /> {/* Spacer for label column */}
                  <div className="col-span-full relative h-9" style={{ gridColumn: `2 / -1` }}>
                    {propRes.map((r) => {
                      const { startIdx, endIdx, isClampedStart, isClampedEnd } = getBarPosition(r);

                      const colPct = 100 / VISIBLE_DAYS;
                      // Start midway into check-in day, unless clamped to start of range
                      const leftPct = startIdx * colPct + (isClampedStart ? 0 : colPct * 0.4);
                      // End ~30% into checkout day, unless clamped
                      const rightPct = (VISIBLE_DAYS - 1 - endIdx) * colPct + (isClampedEnd ? 0 : colPct * 0.65);
                      const widthPct = 100 - leftPct - rightPct;

                      if (widthPct <= 0) return null;

                      return (
                        <button
                          key={r.id}
                          onClick={() => setSelected(r)}
                          className={`absolute top-1.5 h-6 rounded-full text-[10px] font-semibold text-white flex items-center px-2.5 truncate cursor-pointer hover:brightness-110 active:scale-[0.98] transition-all z-10 shadow-sm ${color} ${
                            r.isCleaned ? "opacity-40" : ""
                          }`}
                          style={{
                            left: `${leftPct}%`,
                            width: `${widthPct}%`,
                            minWidth: "24px",
                          }}
                        >
                          <span className="truncate">
                            {r.numGuests}g
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Detail modal */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-sm">
          {selected &&
            (() => {
              const adults =
                selected.guestList?.filter((g) => g.age_group === "over_21").length ?? 0;
              const children =
                selected.guestList?.filter((g) => g.age_group === "under_21").length ?? 0;
              const infants =
                selected.guestList?.filter((g) => g.age_group === "infant").length ?? 0;
              const petCount =
                selected.pets?.filter((p) => p.name?.trim()).length ?? 0;
              const hasBreakdown = selected.guestList && selected.guestList.length > 0;

              return (
                <>
                  <DialogHeader>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg overflow-hidden shrink-0">
                        {selected.propertyCoverImage ? (
                          <img
                            src={selected.propertyCoverImage}
                            alt={selected.propertyName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-linear-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center">
                            <Home className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                          </div>
                        )}
                      </div>
                      <DialogTitle className="text-base">{selected.propertyName}</DialogTitle>
                    </div>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <CalendarDays className="h-4 w-4" />
                        <span>{formatDateLong(selected.checkIn)}</span>
                      </div>
                      <span className="text-muted-foreground">&rarr;</span>
                      <div className="text-muted-foreground">{formatDateLong(selected.checkOut)}</div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      {hasBreakdown ? (
                        <>
                          {adults > 0 && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <User className="h-4 w-4" />
                              {adults} adult{adults !== 1 ? "s" : ""}
                            </span>
                          )}
                          {children > 0 && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Users className="h-4 w-4" />
                              {children} child{children !== 1 ? "ren" : ""}
                            </span>
                          )}
                          {infants > 0 && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Baby className="h-4 w-4" />
                              {infants} infant{infants !== 1 ? "s" : ""}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Users className="h-4 w-4" />
                          {selected.numGuests} guest{selected.numGuests !== 1 ? "s" : ""}
                        </span>
                      )}
                      {petCount > 0 && (
                        <span className="flex items-center gap-1 text-amber-600 font-medium">
                          <PawPrint className="h-4 w-4" />
                          {petCount} pet{petCount !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>

                    {selected.upsellLabels.length > 0 && (
                      <>
                        <Separator />
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <Sparkles className="h-3 w-3" />
                            Purchased Add-ons
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {selected.upsellLabels.map((label) => (
                              <Badge key={label} variant="secondary" className="text-xs">
                                {label}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    <Separator />
                    <Badge
                      variant={selected.isCleaned ? "default" : "destructive"}
                      className={selected.isCleaned ? "bg-green-600" : ""}
                    >
                      {selected.isCleaned ? "Cleaned" : "Not cleaned"}
                    </Badge>
                  </div>
                </>
              );
            })()}
        </DialogContent>
      </Dialog>
    </>
  );
}
