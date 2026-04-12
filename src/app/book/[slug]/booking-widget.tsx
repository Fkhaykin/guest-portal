"use client";

import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/* ------------------------------------------------------------------ */
/*  Types & helpers                                                    */
/* ------------------------------------------------------------------ */

type AvailabilityPeriod = {
  start: string;
  end: string;
  available: number;
};

function toDateStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDate(s: string) {
  return new Date(s + "T00:00:00");
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function addMonths(d: Date, n: number) {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getNightCount(checkIn: string, checkOut: string) {
  return Math.round(
    (parseDate(checkOut).getTime() - parseDate(checkIn).getTime()) / (1000 * 60 * 60 * 24)
  );
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_HEADERS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/* ------------------------------------------------------------------ */
/*  Calendar Component                                                 */
/* ------------------------------------------------------------------ */

export function BookingCalendar({
  lodgifyPropertyId,
  lodgifySlug,
  checkIn: initialCheckIn,
  checkOut: initialCheckOut,
  guests: initialGuests,
}: {
  lodgifyPropertyId: number;
  lodgifySlug: string;
  checkIn?: string;
  checkOut?: string;
  guests?: string;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [viewMonth, setViewMonth] = useState(
    initialCheckIn ? parseDate(initialCheckIn) : today
  );
  const [checkIn, setCheckIn] = useState<string | null>(initialCheckIn || null);
  const [checkOut, setCheckOut] = useState<string | null>(initialCheckOut || null);
  const [periods, setPeriods] = useState<AvailabilityPeriod[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch 6 months of availability
  useEffect(() => {
    const start = toDateStr(today);
    const endDate = addMonths(today, 6);
    const end = toDateStr(endDate);

    fetch(`/api/availability/calendar?property_id=${lodgifyPropertyId}&start=${start}&end=${end}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.periods) setPeriods(data.periods);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [lodgifyPropertyId]);

  // Build a set of booked dates for fast lookup
  const bookedDates = useMemo(() => {
    const set = new Set<string>();
    for (const p of periods) {
      if (p.available === 0) {
        const start = parseDate(p.start);
        const end = parseDate(p.end);
        for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
          set.add(toDateStr(d));
        }
      }
    }
    return set;
  }, [periods]);

  function isBooked(dateStr: string) {
    return bookedDates.has(dateStr);
  }

  function isPast(d: Date) {
    return d < today;
  }

  function handleDateClick(dateStr: string) {
    if (isBooked(dateStr) || parseDate(dateStr) < today) return;

    if (!checkIn || (checkIn && checkOut)) {
      // Start new selection
      setCheckIn(dateStr);
      setCheckOut(null);
    } else {
      // Complete selection
      if (dateStr < checkIn) {
        setCheckIn(dateStr);
        setCheckOut(checkIn);
      } else if (dateStr === checkIn) {
        setCheckIn(null);
      } else {
        // Check if any booked dates fall in range
        const start = parseDate(checkIn);
        const end = parseDate(dateStr);
        let hasConflict = false;
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          if (isBooked(toDateStr(d))) {
            hasConflict = true;
            break;
          }
        }
        if (hasConflict) {
          setCheckIn(dateStr);
          setCheckOut(null);
        } else {
          setCheckOut(dateStr);
        }
      }
    }
  }

  function isInRange(dateStr: string) {
    if (!checkIn || !checkOut) return false;
    return dateStr >= checkIn && dateStr <= checkOut;
  }

  function isRangeStart(dateStr: string) {
    return checkIn === dateStr;
  }

  function isRangeEnd(dateStr: string) {
    return checkOut === dateStr;
  }

  // Build checkout URL
  const guests = initialGuests || "2";
  const checkoutParams = new URLSearchParams();
  if (checkIn) checkoutParams.set("arrival", checkIn.replace(/-/g, ""));
  if (checkOut) checkoutParams.set("departure", checkOut.replace(/-/g, ""));
  checkoutParams.set("adults", guests);
  checkoutParams.set("children", "0");
  checkoutParams.set("pets", "0");
  checkoutParams.set("infants", "0");
  const checkoutUrl = `https://checkout.lodgify.com/en/summitlakeside/${lodgifyPropertyId}/reservation?${checkoutParams}`;

  const nights = checkIn && checkOut ? getNightCount(checkIn, checkOut) : null;

  // Render month
  function renderMonth(monthDate: Date) {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const cells: (number | null)[] = [];

    for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    return (
      <div>
        <h3 className="text-center font-semibold text-sm mb-3">
          {MONTH_NAMES[month]} {year}
        </h3>
        <div className="grid grid-cols-7 gap-0">
          {DAY_HEADERS.map((d) => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1.5">
              {d}
            </div>
          ))}
          {cells.map((day, i) => {
            if (day === null) {
              return <div key={`empty-${i}`} className="h-10" />;
            }

            const d = new Date(year, month, day);
            const dateStr = toDateStr(d);
            const booked = isBooked(dateStr);
            const past = isPast(d);
            const disabled = booked || past;
            const inRange = isInRange(dateStr);
            const rangeStart = isRangeStart(dateStr);
            const rangeEnd = isRangeEnd(dateStr);
            const isToday = isSameDay(d, today);

            return (
              <button
                key={dateStr}
                disabled={disabled}
                onClick={() => handleDateClick(dateStr)}
                className={`
                  h-10 text-sm relative transition-colors
                  ${past ? "text-muted-foreground/30 cursor-not-allowed" : ""}
                  ${booked && !past ? "bg-red-100 dark:bg-red-950/40 text-red-400 dark:text-red-500 cursor-not-allowed line-through" : ""}
                  ${!disabled ? "hover:bg-primary/10 cursor-pointer" : ""}
                  ${inRange && !rangeStart && !rangeEnd ? "bg-primary/10" : ""}
                  ${rangeStart ? "bg-primary text-primary-foreground rounded-l-lg" : ""}
                  ${rangeEnd ? "bg-primary text-primary-foreground rounded-r-lg" : ""}
                  ${rangeStart && !checkOut ? "rounded-lg" : ""}
                  ${isToday && !rangeStart && !rangeEnd ? "font-bold" : ""}
                `}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const nextMonth = addMonths(viewMonth, 1);
  const maxMonth = addMonths(today, 5);

  return (
    <div className="rounded-xl border bg-card p-5 sm:p-6 space-y-5">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Month navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setViewMonth(addMonths(viewMonth, -1))}
              disabled={viewMonth <= today}
              className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMonth(addMonths(viewMonth, 1))}
              disabled={viewMonth >= maxMonth}
              className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Two-month calendar grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
            {renderMonth(viewMonth)}
            {renderMonth(nextMonth)}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-primary" /> Selected
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-primary/10" /> In range
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-red-100 dark:bg-red-950/40" /> Booked
            </span>
          </div>
        </>
      )}

      {/* Selection summary + Book button */}
      <div className="border-t pt-5 space-y-3">
        {checkIn && checkOut ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                {parseDate(checkIn).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                {" "}&mdash;{" "}
                {parseDate(checkOut).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
              <p className="text-sm font-medium">
                {nights} night{nights !== 1 ? "s" : ""}
              </p>
            </div>
            <a href={checkoutUrl} target="_blank" rel="noopener noreferrer">
              <Button size="lg" className="gap-2">
                Book Now
                <ExternalLink className="h-4 w-4" />
              </Button>
            </a>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center">
            {checkIn
              ? "Select a check-out date"
              : "Select your check-in date to see availability"}
          </p>
        )}
      </div>
    </div>
  );
}
