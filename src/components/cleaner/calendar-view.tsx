"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Reservation = {
  id: string;
  propertyName: string;
  propertyColor: string;
  checkIn: string;
  checkOut: string;
  numGuests: number;
  isCleaned: boolean;
  upsellCount: number;
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}
function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dateFromStr(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Get short property name (first meaningful word + number if present)
function shortName(name: string) {
  // Try to get a recognizable short form
  const words = name.split(/\s+/);
  if (words.length <= 2) return name;
  // Keep first 2-3 words, max ~20 chars
  let short = words[0];
  for (let i = 1; i < words.length && short.length < 16; i++) {
    short += " " + words[i];
  }
  return short;
}

type WeekRow = {
  days: (number | null)[]; // 7 entries, null for padding
  dateStrings: (string | null)[];
};

function buildWeeks(year: number, month: number): WeekRow[] {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const weeks: WeekRow[] = [];
  let currentWeek: WeekRow = { days: [], dateStrings: [] };

  // Pad start
  for (let i = 0; i < firstDay; i++) {
    currentWeek.days.push(null);
    currentWeek.dateStrings.push(null);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    currentWeek.days.push(d);
    currentWeek.dateStrings.push(ds);
    if (currentWeek.days.length === 7) {
      weeks.push(currentWeek);
      currentWeek = { days: [], dateStrings: [] };
    }
  }

  // Pad end
  if (currentWeek.days.length > 0) {
    while (currentWeek.days.length < 7) {
      currentWeek.days.push(null);
      currentWeek.dateStrings.push(null);
    }
    weeks.push(currentWeek);
  }

  return weeks;
}

type BarSegment = {
  reservation: Reservation;
  startCol: number; // 0-6
  endCol: number;   // 0-6 (inclusive)
  isStart: boolean; // check-in is in this week
  isEnd: boolean;   // check-out is in this week
};

function getBarSegments(
  reservations: Reservation[],
  week: WeekRow
): BarSegment[] {
  const segments: BarSegment[] = [];
  const weekStart = week.dateStrings.find((d) => d !== null);
  const weekEnd = [...week.dateStrings].reverse().find((d) => d !== null);
  if (!weekStart || !weekEnd) return segments;

  for (const r of reservations) {
    // Reservation is visible this week if it overlaps
    // A reservation occupies from checkIn through checkOut-1 (last night)
    // But we want the bar to start mid-checkIn and end slightly into checkOut
    const lastNight = new Date(dateFromStr(r.checkOut));
    lastNight.setDate(lastNight.getDate() - 1);
    const lastNightStr = toDateStr(lastNight);

    // Does the reservation overlap this week?
    if (r.checkIn > weekEnd || lastNightStr < weekStart) continue;

    // Find start column
    let startCol = 0;
    let isStart = false;
    for (let c = 0; c < 7; c++) {
      const ds = week.dateStrings[c];
      if (ds && ds >= r.checkIn) {
        startCol = c;
        isStart = ds === r.checkIn;
        break;
      }
    }

    // Find end column (the checkout date or last day of week)
    let endCol = 6;
    let isEnd = false;
    for (let c = 6; c >= 0; c--) {
      const ds = week.dateStrings[c];
      if (ds && ds <= r.checkOut) {
        endCol = c;
        isEnd = ds === r.checkOut;
        break;
      }
    }

    // If checkout is beyond this week, extend to end
    if (r.checkOut > weekEnd) {
      endCol = 6;
      isEnd = false;
    }

    segments.push({ reservation: r, startCol, endCol, isStart, isEnd });
  }

  // Sort by property name for consistent stacking
  segments.sort((a, b) => a.reservation.propertyName.localeCompare(b.reservation.propertyName));

  return segments;
}

export function CalendarView({
  reservations,
}: {
  reservations: Reservation[];
}) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const todayStr = toDateStr(today);

  const weeks = buildWeeks(year, month);

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  }

  // Build property color legend
  const propertyNames = [...new Set(reservations.map((r) => r.propertyName))].sort();
  const propertyColorMap = new Map(
    reservations.map((r) => [r.propertyName, r.propertyColor])
  );

  return (
    <Card className="p-4 overflow-x-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="icon" onClick={prevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center">
          <h3 className="font-semibold">{MONTH_NAMES[month]} {year}</h3>
          <button
            onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); }}
            className="text-xs text-primary hover:underline"
          >
            Today
          </button>
        </div>
        <Button variant="ghost" size="icon" onClick={nextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b">
        {DAY_HEADERS.map((d) => (
          <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Weeks */}
      {weeks.map((week, wi) => {
        const segments = getBarSegments(reservations, week);

        return (
          <div key={wi} className="border-b last:border-b-0">
            {/* Date number row */}
            <div className="grid grid-cols-7">
              {week.days.map((day, di) => (
                <div
                  key={di}
                  className={`px-1 pt-1 pb-0.5 text-xs font-medium min-h-6 ${
                    week.dateStrings[di] === todayStr
                      ? "text-primary"
                      : day === null
                        ? ""
                        : "text-muted-foreground"
                  }`}
                >
                  {day !== null && (
                    <span
                      className={
                        week.dateStrings[di] === todayStr
                          ? "bg-primary text-primary-foreground rounded-full w-5 h-5 inline-flex items-center justify-center text-[10px]"
                          : ""
                      }
                    >
                      {day}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Reservation bars */}
            {segments.length > 0 && (
              <div className="pb-1 space-y-0.5">
                {segments.map((seg) => {
                  const r = seg.reservation;
                  // Calculate left % and width %
                  // Each column = 1/7 = ~14.28%
                  const colWidth = 100 / 7;
                  // Start: if it's the check-in day, start at 50% of the cell, otherwise start of cell
                  const left = seg.startCol * colWidth + (seg.isStart ? colWidth * 0.4 : 0);
                  // End: if it's the check-out day, end at ~25% into the cell, otherwise end of cell
                  const right = (6 - seg.endCol) * colWidth + (seg.isEnd ? colWidth * 0.65 : 0);
                  const width = 100 - left - right;

                  return (
                    <div key={`${r.id}-${wi}`} className="relative h-5 mx-0.5">
                      <div
                        className={`absolute top-0 h-full rounded-full text-[9px] font-medium text-white flex items-center px-2 truncate ${r.propertyColor} ${
                          r.isCleaned ? "opacity-50" : ""
                        }`}
                        style={{ left: `${left}%`, width: `${width}%` }}
                        title={`${r.propertyName} — ${r.numGuests} guests · ${r.checkIn} → ${r.checkOut}${
                          r.upsellCount > 0 ? ` · ${r.upsellCount} add-ons` : ""
                        }`}
                      >
                        <span className="truncate">
                          {shortName(r.propertyName)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {propertyNames.map((name) => (
          <div key={name} className="flex items-center gap-1.5 text-[10px]">
            <div className={`w-3 h-2 rounded-full ${propertyColorMap.get(name)}`} />
            <span className="text-muted-foreground truncate max-w-32">{name}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
