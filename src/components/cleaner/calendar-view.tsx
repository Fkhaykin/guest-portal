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
  List,
  CalendarRange,
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
  cleaningFeeCents: number;
  petFeeCents: number;
  cleanerRevenueCents: number;
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

export type PropertyGroup = {
  key: string;
  label: string;
  coverImage: string | null;
};

export function CalendarView({
  reservations,
  propertyGroups,
}: {
  reservations: CalendarReservation[];
  propertyGroups: PropertyGroup[];
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Start from beginning of current week (Sunday)
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());

  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [startDate, setStartDate] = useState(startOfWeek);
  const [selected, setSelected] = useState<CalendarReservation | null>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

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

  // Seed all property groups so every house always appears
  const byGroup = new Map<
    string,
    { coverImage: string | null; label: string; reservations: CalendarReservation[] }
  >();
  for (const g of propertyGroups) {
    byGroup.set(g.key, { coverImage: g.coverImage, label: g.label, reservations: [] });
  }
  for (const r of reservations) {
    if (r.checkOut <= rangeStart || r.checkIn > rangeEnd) continue;
    const groupKey = (r.propertyNickname || r.propertyName).toLowerCase();
    if (!byGroup.has(groupKey)) {
      byGroup.set(groupKey, { coverImage: r.propertyCoverImage, label: r.propertyNickname || r.propertyName, reservations: [] });
    }
    byGroup.get(groupKey)!.reservations.push(r);
  }

  const properties = [...byGroup.entries()].sort((a, b) =>
    a[1].label.localeCompare(b[1].label)
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

  // Sort reservations for list view: upcoming first, then by check-in date
  const sortedReservations = [...reservations].sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  const todayStr2 = toDateStr(today);
  const upcomingReservations = sortedReservations.filter((r) => r.checkOut >= todayStr2);
  const pastReservations = sortedReservations.filter((r) => r.checkOut < todayStr2).reverse();

  return (
    <>
      {/* View toggle */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Reservations</h2>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <Button
            variant={viewMode === "calendar" ? "default" : "ghost"}
            size="sm"
            className="h-7 px-2.5 gap-1.5 text-xs"
            onClick={() => setViewMode("calendar")}
          >
            <CalendarRange className="h-3.5 w-3.5" />
            Calendar
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "ghost"}
            size="sm"
            className="h-7 px-2.5 gap-1.5 text-xs"
            onClick={() => setViewMode("list")}
          >
            <List className="h-3.5 w-3.5" />
            List
          </Button>
        </div>
      </div>

      {viewMode === "list" ? (
        <Card className="overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium text-muted-foreground">Property</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Guest</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Check-in</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Check-out</th>
                  <th className="text-center p-3 font-medium text-muted-foreground">Nights</th>
                  <th className="text-center p-3 font-medium text-muted-foreground">Guests</th>
                  <th className="text-center p-3 font-medium text-muted-foreground">Pets</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Cleaning Fee</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Pet Fee</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Total Earnings</th>
                  <th className="text-center p-3 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {upcomingReservations.length > 0 && (
                  <>
                    <tr>
                      <td colSpan={11} className="px-3 pt-3 pb-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Upcoming & Current</p>
                      </td>
                    </tr>
                    {upcomingReservations.map((r) => {
                      const petCount = r.pets?.filter((p) => p.name?.trim()).length ?? 0;
                      return (
                        <tr
                          key={r.id}
                          className="border-b last:border-b-0 hover:bg-muted/30 cursor-pointer transition-colors"
                          onClick={() => setSelected(r)}
                        >
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-md overflow-hidden shrink-0 border border-border/50">
                                {r.propertyCoverImage && !failedImages.has(r.propertyCoverImage) ? (
                                  <img
                                    src={r.propertyCoverImage}
                                    alt={r.propertyName}
                                    className="w-full h-full object-cover"
                                    onError={() => setFailedImages((prev) => new Set(prev).add(r.propertyCoverImage!))}
                                  />
                                ) : (
                                  <div className="w-full h-full bg-muted flex items-center justify-center">
                                    <Home className="h-3 w-3 text-muted-foreground" />
                                  </div>
                                )}
                              </div>
                              <span className="font-medium truncate">{r.propertyNickname || r.propertyName}</span>
                            </div>
                          </td>
                          <td className="p-3 text-foreground">{r.guestName || <span className="text-muted-foreground">Blocked</span>}</td>
                          <td className="p-3 whitespace-nowrap">{formatDateLong(r.checkIn)}</td>
                          <td className="p-3 whitespace-nowrap">{formatDateLong(r.checkOut)}</td>
                          <td className="p-3 text-center">{r.nights}</td>
                          <td className="p-3 text-center">{r.numGuests}</td>
                          <td className="p-3 text-center">
                            {petCount > 0 ? (
                              <span className="text-amber-600 font-medium">{petCount}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="p-3 text-right">${Math.round(r.cleaningFeeCents / 100)}</td>
                          <td className="p-3 text-right">
                            {r.petFeeCents > 0 ? (
                              <span className="text-amber-600">${Math.round(r.petFeeCents / 100)}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="p-3 text-right font-semibold">${Math.round(r.cleanerRevenueCents / 100)}</td>
                          <td className="p-3 text-center">
                            <Badge
                              variant={r.isCleaned ? "default" : "outline"}
                              className={`text-[10px] ${r.isCleaned ? "bg-green-600" : ""}`}
                            >
                              {r.isCleaned ? "Cleaned" : "Pending"}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </>
                )}
                {pastReservations.length > 0 && (
                  <>
                    <tr>
                      <td colSpan={11} className="px-3 pt-4 pb-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Past</p>
                      </td>
                    </tr>
                    {pastReservations.map((r) => {
                      const petCount = r.pets?.filter((p) => p.name?.trim()).length ?? 0;
                      return (
                        <tr
                          key={r.id}
                          className="border-b last:border-b-0 hover:bg-muted/30 cursor-pointer transition-colors opacity-60"
                          onClick={() => setSelected(r)}
                        >
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-md overflow-hidden shrink-0 border border-border/50">
                                {r.propertyCoverImage && !failedImages.has(r.propertyCoverImage) ? (
                                  <img
                                    src={r.propertyCoverImage}
                                    alt={r.propertyName}
                                    className="w-full h-full object-cover"
                                    onError={() => setFailedImages((prev) => new Set(prev).add(r.propertyCoverImage!))}
                                  />
                                ) : (
                                  <div className="w-full h-full bg-muted flex items-center justify-center">
                                    <Home className="h-3 w-3 text-muted-foreground" />
                                  </div>
                                )}
                              </div>
                              <span className="font-medium truncate">{r.propertyNickname || r.propertyName}</span>
                            </div>
                          </td>
                          <td className="p-3 text-foreground">{r.guestName || <span className="text-muted-foreground">Blocked</span>}</td>
                          <td className="p-3 whitespace-nowrap">{formatDateLong(r.checkIn)}</td>
                          <td className="p-3 whitespace-nowrap">{formatDateLong(r.checkOut)}</td>
                          <td className="p-3 text-center">{r.nights}</td>
                          <td className="p-3 text-center">{r.numGuests}</td>
                          <td className="p-3 text-center">
                            {petCount > 0 ? (
                              <span className="text-amber-600 font-medium">{petCount}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="p-3 text-right">${Math.round(r.cleaningFeeCents / 100)}</td>
                          <td className="p-3 text-right">
                            {r.petFeeCents > 0 ? (
                              <span className="text-amber-600">${Math.round(r.petFeeCents / 100)}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="p-3 text-right font-semibold">${Math.round(r.cleanerRevenueCents / 100)}</td>
                          <td className="p-3 text-center">
                            <Badge
                              variant={r.isCleaned ? "default" : "outline"}
                              className={`text-[10px] ${r.isCleaned ? "bg-green-600" : ""}`}
                            >
                              {r.isCleaned ? "Cleaned" : "Pending"}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="md:hidden divide-y">
            {[...upcomingReservations, ...pastReservations].map((r) => {
              const petCount = r.pets?.filter((p) => p.name?.trim()).length ?? 0;
              const isPast = r.checkOut < todayStr2;
              return (
                <button
                  key={r.id}
                  className={`w-full text-left p-4 hover:bg-muted/30 transition-colors ${isPast ? "opacity-60" : ""}`}
                  onClick={() => setSelected(r)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{r.propertyNickname || r.propertyName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {r.guestName || "Blocked"} · {r.numGuests} guest{r.numGuests !== 1 ? "s" : ""}
                        {petCount > 0 && <span className="text-amber-600"> · {petCount} pet{petCount !== 1 ? "s" : ""}</span>}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDateLong(r.checkIn)} → {formatDateLong(r.checkOut)} · {r.nights}n
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-sm">${Math.round(r.cleanerRevenueCents / 100)}</p>
                      <div className="flex flex-col items-end gap-0.5 mt-1">
                        {r.petFeeCents > 0 && (
                          <span className="text-[10px] text-amber-600">+${Math.round(r.petFeeCents / 100)} pet</span>
                        )}
                        <Badge
                          variant={r.isCleaned ? "default" : "outline"}
                          className={`text-[10px] ${r.isCleaned ? "bg-green-600" : ""}`}
                        >
                          {r.isCleaned ? "Cleaned" : "Pending"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
      ) : (
      <Card className="p-4 overflow-x-auto [--label-w:200px] max-sm:[--label-w:60px]">
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
          style={{ gridTemplateColumns: `var(--label-w) repeat(${VISIBLE_DAYS}, 1fr)` }}
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
        <div className="space-y-1 bg-gray-50 dark:bg-gray-900/30 rounded-lg p-2">
          {properties.map(([groupKey, { coverImage, label, reservations: propRes }]) => {
              // Single lane — all bars on one row
              const ROW_H = 28;
              const totalH = ROW_H + 4;

              return (
                <div key={groupKey} className="flex items-start border-b border-muted/10 last:border-b-0 py-1">
                  {/* Property label */}
                  <div className="flex sm:flex-row flex-col items-center gap-1 sm:gap-2.5 pr-1 sm:pr-3 min-w-0 shrink-0 w-(--label-w)">
                    <div className="h-9 w-9 rounded-lg overflow-hidden shrink-0 border border-border/50">
                      {coverImage && !failedImages.has(coverImage) ? (
                        <img
                          src={coverImage}
                          alt={label}
                          className="w-full h-full object-cover"
                          onError={() => setFailedImages((prev) => new Set(prev).add(coverImage))}
                        />
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                          <Home className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <span className="text-[9px] sm:text-xs font-medium truncate block max-w-full text-center sm:text-left">{label}</span>
                  </div>

                  {/* Timeline area */}
                  <div className="flex-1 relative" style={{ height: totalH }}>
                    {/* Grid lines */}
                    <div className="absolute inset-0 grid pointer-events-none" style={{ gridTemplateColumns: `repeat(${VISIBLE_DAYS}, 1fr)` }}>
                      {days.map(({ str }, i) => (
                        <div
                          key={str}
                          className={`border-l h-full border-border/15${i === days.length - 1 ? " border-r" : ""}`}
                        />
                      ))}
                    </div>

                    {/* Bars */}
                    {propRes.map((r) => {
                      const { startIdx, endIdx, isClampedStart, isClampedEnd } = getBarPosition(r);

                      const colPct = 100 / VISIBLE_DAYS;
                      const leftPct = startIdx * colPct + (isClampedStart ? 0 : colPct * 0.4);
                      const rightPct = (VISIBLE_DAYS - 1 - endIdx) * colPct + (isClampedEnd ? 0 : colPct * 0.65);
                      const widthPct = 100 - leftPct - rightPct;

                      if (widthPct <= 0) return null;

                      return (
                        <button
                          key={r.id}
                          onClick={() => setSelected(r)}
                          className={`absolute h-6 rounded-full text-[10px] font-semibold flex items-center px-2.5 truncate cursor-pointer hover:brightness-110 active:scale-[0.98] transition-all z-10 shadow-sm ${
                            !r.guestName
                              ? "bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                              : `bg-teal-700 text-white ${r.isCleaned ? "opacity-40" : ""}`
                          }`}
                          style={{
                            left: `${leftPct}%`,
                            width: `${widthPct}%`,
                            top: 2,
                            minWidth: "24px",
                          }}
                        >
                          <span className="truncate">
                            {r.guestName
                              ? `${r.guestName.split(" ")[0]} · ${r.numGuests}g · $${Math.round(r.cleanerRevenueCents / 100)}`
                              : "Blocked"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>
      </Card>
      )}

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
                  {selected.propertyCoverImage && !failedImages.has(selected.propertyCoverImage) ? (
                    <div className="relative h-36 w-full">
                      <img
                        src={selected.propertyCoverImage}
                        alt={selected.propertyName}
                        className="w-full h-full object-cover"
                        onError={() => setFailedImages((prev) => new Set(prev).add(selected.propertyCoverImage!))}
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
