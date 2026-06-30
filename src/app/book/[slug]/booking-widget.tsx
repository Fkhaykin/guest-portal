"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
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
  propertySlug,
  checkIn: initialCheckIn,
  checkOut: initialCheckOut,
  guests: initialGuests,
  pets: initialPets,
}: {
  lodgifyPropertyId: number;
  propertySlug: string;
  checkIn?: string;
  checkOut?: string;
  guests?: string;
  pets?: string;
}) {
  const router = useRouter();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [viewMonth, setViewMonth] = useState(() => {
    if (initialCheckIn) {
      const d = parseDate(initialCheckIn);
      return d >= today ? new Date(d.getFullYear(), d.getMonth(), 1) : currentMonth;
    }
    return currentMonth;
  });
  const [checkIn, setCheckIn] = useState<string | null>(
    initialCheckIn && parseDate(initialCheckIn) >= today ? initialCheckIn : null
  );
  const [checkOut, setCheckOut] = useState<string | null>(
    initialCheckOut && initialCheckIn && parseDate(initialCheckIn) >= today ? initialCheckOut : null
  );
  const [periods, setPeriods] = useState<AvailabilityPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [quote, setQuote] = useState<{ total: number; currency: string } | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

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

  // Fetch price quote when dates are selected
  useEffect(() => {
    if (!checkIn || !checkOut) {
      setQuote(null);
      return;
    }
    setQuoteLoading(true);
    const guests = initialGuests || "2";
    fetch(`/api/availability/quote?property_id=${lodgifyPropertyId}&arrival=${checkIn}&departure=${checkOut}&guests=${guests}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.total) setQuote(data);
        else setQuote(null);
      })
      .catch(() => setQuote(null))
      .finally(() => setQuoteLoading(false));
  }, [checkIn, checkOut, lodgifyPropertyId, initialGuests]);

  // Build a set of booked NIGHTS for fast lookup. Lodgify availability periods
  // are inclusive ranges of occupied nights (a booking arriving the 4th and
  // departing the 7th reports nights 4–6 as `available: 0`), so we iterate
  // through `end` inclusive. A stay only consumes the nights of [check-in,
  // check-out) — never the checkout day itself — so same-day turnover (checking
  // out the morning another guest checks in) is allowed.
  const bookedNights = useMemo(() => {
    const set = new Set<string>();
    for (const p of periods) {
      if (p.available === 0) {
        const start = parseDate(p.start);
        const end = parseDate(p.end);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          set.add(toDateStr(d));
        }
      }
    }
    return set;
  }, [periods]);

  function isNightBooked(dateStr: string) {
    return bookedNights.has(dateStr);
  }

  // True when every night of the stay [ci, co) is free. The checkout day (co)
  // is excluded — that night belongs to the next guest, not this stay.
  function rangeNightsFree(ci: string, co: string) {
    for (let d = parseDate(ci); toDateStr(d) < co; d.setDate(d.getDate() + 1)) {
      if (isNightBooked(toDateStr(d))) return false;
    }
    return true;
  }

  function isPast(d: Date) {
    return d < today;
  }

  // Whether a day can be clicked given the current selection. When picking a
  // checkout (check-in already set), a day is valid if all nights up to — but
  // not including — it are free; that day's own night may be booked (turnover).
  // When starting a fresh selection, a day is valid only if its night is free.
  function isSelectable(dateStr: string, d: Date) {
    if (isPast(d)) return false;
    if (checkIn && !checkOut) {
      if (dateStr === checkIn) return true; // click again to clear
      if (dateStr > checkIn) return rangeNightsFree(checkIn, dateStr);
      return !isNightBooked(dateStr); // earlier day → potential new check-in
    }
    return !isNightBooked(dateStr);
  }

  function handleDateClick(dateStr: string) {
    const d = parseDate(dateStr);
    if (d < today) return;

    // Starting a new selection (nothing selected, or a complete range exists)
    if (!checkIn || (checkIn && checkOut)) {
      if (isNightBooked(dateStr)) return; // can't begin a stay on an occupied night
      setCheckIn(dateStr);
      setCheckOut(null);
      return;
    }

    // check-in is set, check-out is not → this click resolves the check-out
    if (dateStr === checkIn) {
      setCheckIn(null);
    } else if (dateStr < checkIn) {
      // Clicked before the check-in → restart selection here if it can begin a stay
      if (!isNightBooked(dateStr)) {
        setCheckIn(dateStr);
        setCheckOut(null);
      }
    } else if (rangeNightsFree(checkIn, dateStr)) {
      setCheckOut(dateStr);
    } else {
      // Range crosses an occupied night → restart from the clicked day if possible
      if (!isNightBooked(dateStr)) {
        setCheckIn(dateStr);
        setCheckOut(null);
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

  // Build checkout URL (internal)
  const guests = initialGuests || "2";
  const petsParam = initialPets || "0";
  const checkoutUrl = checkIn && checkOut
    ? `/book/${propertySlug}/checkout?check_in=${checkIn}&check_out=${checkOut}&guests=${guests}&pets=${petsParam}`
    : null;

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
            const past = isPast(d);
            const disabled = !isSelectable(dateStr, d);
            const inRange = isInRange(dateStr);
            const rangeStart = isRangeStart(dateStr);
            const rangeEnd = isRangeEnd(dateStr);
            // Show the "booked" treatment only for occupied nights the guest
            // can't select right now and that aren't part of the current
            // selection — so a turnover checkout day reads as selectable.
            const booked =
              isNightBooked(dateStr) &&
              disabled &&
              !rangeStart &&
              !rangeEnd &&
              !inRange;
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
              disabled={viewMonth <= currentMonth}
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
                {quoteLoading ? (
                  <span className="text-muted-foreground"> &middot; loading price&hellip;</span>
                ) : quote ? (
                  <span> &middot; ${Math.round(quote.total).toLocaleString()}</span>
                ) : null}
              </p>
            </div>
            <Button
              size="lg"
              onClick={() => checkoutUrl && router.push(checkoutUrl)}
            >
              Continue to Checkout
            </Button>
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
