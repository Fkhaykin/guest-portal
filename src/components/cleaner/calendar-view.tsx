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
  Moon,
  Clock,
  CalendarPlus,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import type { GuestListEntry, PetEntry } from "@/types/database";

export type CalendarReservation = {
  id: string;
  propertyName: string;
  propertyNickname: string | null;
  propertyCoverImage: string | null;
  propertyColor: string;
  checkIn: string;
  checkOut: string;
  numGuests: number;
  guestName: string | null;
  guestList: GuestListEntry[] | null;
  pets: PetEntry[] | null;
  isCleaned: boolean;
  upsellCount: number;
  upsellLabels: string[];
  bookedAt: string | null;
  status: string;
  nights: number;
  hasEarlyCheckin: boolean;
  hasLateCheckout: boolean;
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

// Assign vertical lanes so overlapping bars don't collide
function assignLanes(
  reservations: CalendarReservation[],
  getPos: (r: CalendarReservation) => { startIdx: number; endIdx: number; isClampedStart: boolean; isClampedEnd: boolean }
): number[] {
  // Sort by start position
  const indexed = reservations.map((r, i) => ({ r, i, ...getPos(r) }));
  indexed.sort((a, b) => a.startIdx - b.startIdx || a.endIdx - b.endIdx);

  const lanes: number[] = new Array(reservations.length).fill(0);
  // Track end position of each lane
  const laneEnds: number[] = [];

  for (const item of indexed) {
    // Find first lane where this bar doesn't overlap
    let assigned = -1;
    for (let l = 0; l < laneEnds.length; l++) {
      if (laneEnds[l] <= item.startIdx) {
        assigned = l;
        break;
      }
    }
    if (assigned === -1) {
      assigned = laneEnds.length;
      laneEnds.push(0);
    }
    lanes[item.i] = assigned;
    laneEnds[assigned] = item.endIdx + 1;
  }

  return lanes;
}

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
    { color: string; coverImage: string | null; nickname: string | null; reservations: CalendarReservation[] }
  >();
  for (const r of reservations) {
    if (r.checkOut <= rangeStart || r.checkIn > rangeEnd) continue;
    if (!byProperty.has(r.propertyName)) {
      byProperty.set(r.propertyName, {
        color: r.propertyColor,
        coverImage: r.propertyCoverImage,
        nickname: r.propertyNickname,
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
      <Card className="p-4 overflow-x-auto">
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
          style={{ gridTemplateColumns: `200px repeat(${VISIBLE_DAYS}, 1fr)` }}
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
          <div className="space-y-1">
            {properties.map(([propName, { color, coverImage, nickname, reservations: propRes }]) => {
              // Assign lanes to avoid overlaps
              const lanes = assignLanes(propRes, getBarPosition);
              const laneCount = Math.max(1, ...lanes.map((l) => l + 1));
              const ROW_H = 28; // px per lane
              const totalH = laneCount * ROW_H + 4; // +padding

              return (
                <div key={propName} className="flex items-start border-b border-muted/10 last:border-b-0 py-1">
                  {/* Property label */}
                  <div className="flex items-center gap-2.5 pr-3 min-w-0 shrink-0" style={{ width: 200 }}>
                    <div className="h-9 w-9 rounded-lg overflow-hidden shrink-0 border border-border/50">
                      {coverImage ? (
                        <img src={coverImage} alt={propName} className="w-full h-full object-cover" />
                      ) : (
                        <div className={`w-full h-full ${color} opacity-20 flex items-center justify-center`}>
                          <Home className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-medium truncate block">{propName}</span>
                      {nickname && (
                        <span className="text-[10px] text-muted-foreground truncate block">{nickname}</span>
                      )}
                    </div>
                  </div>

                  {/* Timeline area */}
                  <div className="flex-1 relative" style={{ height: totalH }}>
                    {/* Grid lines */}
                    <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${VISIBLE_DAYS}, 1fr)` }}>
                      {days.map(({ str, date }) => {
                        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                        return (
                          <div
                            key={str}
                            className={`border-l h-full ${
                              isWeekend ? "bg-muted/20 border-muted/20" : "border-muted/15"
                            }`}
                          />
                        );
                      })}
                    </div>

                    {/* Bars */}
                    {propRes.map((r, rIdx) => {
                      const { startIdx, endIdx, isClampedStart, isClampedEnd } = getBarPosition(r);
                      const lane = lanes[rIdx];

                      const colPct = 100 / VISIBLE_DAYS;
                      const leftPct = startIdx * colPct + (isClampedStart ? 0 : colPct * 0.4);
                      const rightPct = (VISIBLE_DAYS - 1 - endIdx) * colPct + (isClampedEnd ? 0 : colPct * 0.65);
                      const widthPct = 100 - leftPct - rightPct;

                      if (widthPct <= 0) return null;

                      return (
                        <button
                          key={r.id}
                          onClick={() => setSelected(r)}
                          className={`absolute h-6 rounded-full text-[10px] font-semibold text-white flex items-center px-2.5 truncate cursor-pointer hover:brightness-110 active:scale-[0.98] transition-all z-10 shadow-sm ${color} ${
                            r.isCleaned ? "opacity-40" : ""
                          }`}
                          style={{
                            left: `${leftPct}%`,
                            width: `${widthPct}%`,
                            top: lane * ROW_H + 2,
                            minWidth: "24px",
                          }}
                        >
                          <span className="truncate">
                            {r.guestName
                              ? `${r.guestName.split(" ")[0]} · ${r.numGuests}g`
                              : `${r.numGuests}g`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Detail modal */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
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
              const checkInTime = selected.hasEarlyCheckin ? "1:00 PM (early)" : "4:00 PM";
              const checkOutTime = selected.hasLateCheckout ? "2:00 PM (late)" : "11:00 AM";

              return (
                <>
                  {/* Cover image header */}
                  {selected.propertyCoverImage ? (
                    <div className="relative h-36 w-full">
                      <img
                        src={selected.propertyCoverImage}
                        alt={selected.propertyName}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <h2 className="text-white font-bold text-lg leading-tight">
                          {selected.propertyName}
                        </h2>
                        <p className="text-white/80 text-sm mt-0.5">
                          {selected.guestName || "Blocked"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <DialogHeader className="px-5 pt-5 pb-0">
                      <DialogTitle className="text-lg">{selected.propertyName}</DialogTitle>
                      <p className="text-sm text-muted-foreground">
                        {selected.guestName || "Blocked"}
                      </p>
                    </DialogHeader>
                  )}

                  <div className="p-5 space-y-4">
                    {/* Dates row */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border p-3 space-y-0.5">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                          Check-in
                        </p>
                        <p className="text-sm font-semibold">{formatDateLong(selected.checkIn)}</p>
                        <p className="text-xs text-primary font-medium">{checkInTime}</p>
                      </div>
                      <div className="rounded-lg border p-3 space-y-0.5">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                          Check-out
                        </p>
                        <p className="text-sm font-semibold">{formatDateLong(selected.checkOut)}</p>
                        <p className="text-xs text-primary font-medium">{checkOutTime}</p>
                      </div>
                    </div>

                    {/* Stay info chips */}
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <Moon className="h-3 w-3" />
                        {selected.nights} night{selected.nights !== 1 ? "s" : ""}
                      </Badge>
                      <Badge
                        variant={selected.isCleaned ? "default" : "destructive"}
                        className={`gap-1 text-xs ${selected.isCleaned ? "bg-green-600" : ""}`}
                      >
                        {selected.isCleaned ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <XCircle className="h-3 w-3" />
                        )}
                        {selected.isCleaned ? "Cleaned" : "Not cleaned"}
                      </Badge>
                      <Badge variant="outline" className="gap-1 text-xs capitalize">
                        {selected.status}
                      </Badge>
                    </div>

                    <Separator />

                    {/* Guests */}
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Guests
                      </p>
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        {hasBreakdown ? (
                          <>
                            {adults > 0 && (
                              <span className="flex items-center gap-1.5 text-foreground">
                                <User className="h-4 w-4 text-muted-foreground" />
                                {adults} adult{adults !== 1 ? "s" : ""}
                              </span>
                            )}
                            {children > 0 && (
                              <span className="flex items-center gap-1.5 text-foreground">
                                <Users className="h-4 w-4 text-muted-foreground" />
                                {children} child{children !== 1 ? "ren" : ""}
                              </span>
                            )}
                            {infants > 0 && (
                              <span className="flex items-center gap-1.5 text-foreground">
                                <Baby className="h-4 w-4 text-muted-foreground" />
                                {infants} infant{infants !== 1 ? "s" : ""}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="flex items-center gap-1.5 text-foreground">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            {selected.numGuests} guest{selected.numGuests !== 1 ? "s" : ""}
                          </span>
                        )}
                        {petCount > 0 && (
                          <span className="flex items-center gap-1.5 text-amber-600 font-medium">
                            <PawPrint className="h-4 w-4" />
                            {petCount} pet{petCount !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Add-ons */}
                    {selected.upsellLabels.length > 0 && (
                      <>
                        <Separator />
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
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

                    {/* Booking meta */}
                    {selected.bookedAt && (
                      <>
                        <Separator />
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CalendarPlus className="h-3.5 w-3.5" />
                          Booked {formatDateLong(selected.bookedAt.split("T")[0])}
                        </div>
                      </>
                    )}
                  </div>
                </>
              );
            })()}
        </DialogContent>
      </Dialog>
    </>
  );
}
