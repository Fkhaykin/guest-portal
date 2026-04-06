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
import { ChevronLeft, ChevronRight, Users, CalendarDays, Sparkles, User, Baby, PawPrint, Home } from "lucide-react";
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

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_HEADERS = ["S", "M", "T", "W", "T", "F", "S"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}
function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function CalendarView({
  reservations,
}: {
  reservations: CalendarReservation[];
}) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState<CalendarReservation | null>(null);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const todayStr = toDateStr(today);

  // Month boundaries as strings
  const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const monthEnd = `${year}-${String(month + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

  // Group reservations by property
  const byProperty = new Map<string, { color: string; coverImage: string | null; reservations: CalendarReservation[] }>();
  for (const r of reservations) {
    // Does this reservation overlap this month?
    if (r.checkOut <= monthStart || r.checkIn > monthEnd) continue;
    if (!byProperty.has(r.propertyName)) {
      byProperty.set(r.propertyName, { color: r.propertyColor, coverImage: r.propertyCoverImage, reservations: [] });
    }
    byProperty.get(r.propertyName)!.reservations.push(r);
  }

  // Sort properties alphabetically
  const properties = [...byProperty.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  // Total columns = padding + days in month
  const totalCols = firstDay + daysInMonth;
  const totalWeekCols = Math.ceil(totalCols / 7) * 7;

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  }

  // For a reservation, get the column range (0-indexed, where col 0 = first cell)
  function getColRange(r: CalendarReservation) {
    // Parse check-in day of month
    const ciDate = new Date(r.checkIn + "T00:00:00");
    const coDate = new Date(r.checkOut + "T00:00:00");

    // Clamp to month
    const startDay = ciDate.getFullYear() === year && ciDate.getMonth() === month
      ? ciDate.getDate()
      : 1;
    const endDay = coDate.getFullYear() === year && coDate.getMonth() === month
      ? coDate.getDate()
      : daysInMonth;

    const startCol = firstDay + startDay - 1;
    const endCol = firstDay + endDay - 1;

    const isClampedStart = !(ciDate.getFullYear() === year && ciDate.getMonth() === month);
    const isClampedEnd = !(coDate.getFullYear() === year && coDate.getMonth() === month);

    return { startCol, endCol, isClampedStart, isClampedEnd };
  }

  return (
    <>
      <Card className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <Button variant="ghost" size="icon" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center">
            <h3 className="font-semibold text-sm">{MONTH_NAMES[month]} {year}</h3>
            <button
              onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); }}
              className="text-[10px] text-primary hover:underline"
            >
              Today
            </button>
          </div>
          <Button variant="ghost" size="icon" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Day number header */}
        <div
          className="grid gap-0 border-b pb-1 mb-1"
          style={{ gridTemplateColumns: `140px repeat(${totalWeekCols}, 1fr)` }}
        >
          <div /> {/* Property label column */}
          {Array.from({ length: totalWeekCols }, (_, i) => {
            const dayNum = i - firstDay + 1;
            const isValid = dayNum >= 1 && dayNum <= daysInMonth;
            const dayStr = isValid
              ? `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`
              : null;
            const isToday = dayStr === todayStr;
            const dayOfWeek = isValid ? new Date(year, month, dayNum).getDay() : -1;
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

            return (
              <div
                key={i}
                className={`text-center text-[9px] leading-tight ${
                  isToday
                    ? "font-bold text-primary"
                    : isValid
                      ? isWeekend ? "text-muted-foreground/50" : "text-muted-foreground"
                      : ""
                }`}
              >
                {isValid && (
                  <>
                    <div className="text-[8px]">{DAY_HEADERS[dayOfWeek]}</div>
                    <div className={isToday ? "bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center mx-auto text-[8px]" : ""}>
                      {dayNum}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Property rows */}
        {properties.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No reservations this month.
          </p>
        ) : (
          <div className="space-y-1">
            {properties.map(([propName, { color, coverImage, reservations: propReservations }]) => (
              <div
                key={propName}
                className="grid gap-0 items-center"
                style={{ gridTemplateColumns: `140px repeat(${totalWeekCols}, 1fr)` }}
              >
                {/* Property thumbnail + name */}
                <div className="flex items-center gap-2 pr-2 min-w-0">
                  <div className="h-7 w-7 rounded overflow-hidden shrink-0">
                    {coverImage ? (
                      <img src={coverImage} alt={propName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-linear-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center">
                        <Home className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] font-medium truncate text-muted-foreground">
                    {propName}
                  </span>
                </div>

                {/* Grid cells with reservation bars overlaid */}
                {Array.from({ length: totalWeekCols }, (_, colIdx) => {
                  const dayNum = colIdx - firstDay + 1;
                  const isValid = dayNum >= 1 && dayNum <= daysInMonth;
                  const dayOfWeek = isValid ? new Date(year, month, dayNum).getDay() : -1;
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                  // Find reservation that starts at this column
                  const startingHere = propReservations.filter((r) => {
                    const { startCol } = getColRange(r);
                    return startCol === colIdx;
                  });

                  return (
                    <div
                      key={colIdx}
                      className={`relative h-6 ${
                        isValid
                          ? isWeekend ? "bg-muted/20" : "bg-transparent"
                          : ""
                      } ${isValid ? "border-l border-muted/30" : ""}`}
                    >
                      {startingHere.map((r) => {
                        const { startCol, endCol, isClampedStart, isClampedEnd } = getColRange(r);
                        const span = endCol - startCol + 1;

                        // Offset: start midway on check-in day, unless clamped
                        const leftOffset = isClampedStart ? "0%" : "40%";
                        // End: bleed ~30% into checkout day, unless clamped
                        const rightTrim = isClampedEnd ? "0%" : "65%";

                        return (
                          <button
                            key={r.id}
                            onClick={() => setSelected(r)}
                            className={`absolute top-0.5 h-5 rounded-full text-[8px] font-medium text-white flex items-center px-1.5 truncate cursor-pointer hover:brightness-110 transition-all z-10 ${color} ${
                              r.isCleaned ? "opacity-40" : ""
                            }`}
                            style={{
                              left: leftOffset,
                              width: `calc(${span * 100}% - ${leftOffset} - ${rightTrim})`,
                            }}
                            title={`${r.propertyName} · ${r.checkIn} → ${r.checkOut}`}
                          >
                            <span className="truncate">{r.numGuests}g</span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Detail modal */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-sm">
          {selected && (() => {
            const adults = selected.guestList?.filter((g) => g.age_group === "over_21").length ?? 0;
            const children = selected.guestList?.filter((g) => g.age_group === "under_21").length ?? 0;
            const infants = selected.guestList?.filter((g) => g.age_group === "infant").length ?? 0;
            const petCount = selected.pets?.filter((p) => p.name?.trim()).length ?? 0;
            const hasBreakdown = selected.guestList && selected.guestList.length > 0;

            return (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg overflow-hidden shrink-0">
                      {selected.propertyCoverImage ? (
                        <img src={selected.propertyCoverImage} alt={selected.propertyName} className="w-full h-full object-cover" />
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
                      <span>{formatDate(selected.checkIn)}</span>
                    </div>
                    <span className="text-muted-foreground">&rarr;</span>
                    <div className="text-muted-foreground">
                      {formatDate(selected.checkOut)}
                    </div>
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
                      <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
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
                  <div className="flex items-center gap-2">
                    <Badge variant={selected.isCleaned ? "default" : "destructive"} className={selected.isCleaned ? "bg-green-600" : ""}>
                      {selected.isCleaned ? "Cleaned" : "Not cleaned"}
                    </Badge>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </>
  );
}
