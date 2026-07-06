"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

type AvailabilityPeriod = {
  start: string;
  end: string;
  available: number;
  // false = tentative (amber, unpaid hold); true = booked/blocked (red, gated).
  confirmed: boolean;
  kind?: "booking" | "block";
  label?: string; // reason, for owner blocks
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_HEADERS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function toDateStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDate(s: string) {
  return new Date(s + "T00:00:00");
}

function addMonths(d: Date, n: number) {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

interface Props {
  lodgifyPropertyId: number | null;
  checkIn: string | null;
  checkOut: string | null;
  onChange: (range: { checkIn: string | null; checkOut: string | null }) => void;
  // Reports whether the current selection overlaps confirmed-booked nights, so the
  // parent can require the admin to acknowledge a deliberate double booking.
  onConflictChange?: (conflict: boolean) => void;
  monthsToShow?: number;       // calendar fetch window (default 12)
  monthsVisible?: number;      // months rendered side-by-side (default 2)
  // Allow selecting dates in the past (admin backfill of already-started/completed
  // stays). Off by default so normal flows keep past dates locked.
  allowPast?: boolean;
}

// Two-month calendar with Lodgify availability shaded as booked.
// Selecting a check-in starts a range; selecting check-out before check-in restarts.
// Booked dates stay visibly blocked but remain clickable: the admin can deliberately
// select across them to create a double booking (with acknowledgment in the parent form).
export function BookingDatePicker({
  lodgifyPropertyId,
  checkIn,
  checkOut,
  onChange,
  onConflictChange,
  monthsToShow = 12,
  monthsVisible = 2,
  allowPast = false,
}: Props) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [viewMonth, setViewMonth] = useState(() => {
    if (checkIn) {
      const d = parseDate(checkIn);
      if (d >= today) return new Date(d.getFullYear(), d.getMonth(), 1);
    }
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const [periods, setPeriods] = useState<AvailabilityPeriod[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!lodgifyPropertyId) {
      setPeriods([]);
      return;
    }
    const start = toDateStr(today);
    const end = toDateStr(addMonths(today, monthsToShow));
    setLoading(true);
    fetch(`/api/availability/calendar?property_id=${lodgifyPropertyId}&start=${start}&end=${end}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setPeriods(data?.periods ?? []))
      .catch(() => setPeriods([]))
      .finally(() => setLoading(false));
  }, [lodgifyPropertyId, monthsToShow, today]);

  const { bookedDates, tentativeDates, blockLabels } = useMemo(() => {
    const booked = new Set<string>();
    const tentative = new Set<string>();
    const labels = new Map<string, string>();
    for (const p of periods) {
      if (p.available !== 0) continue;
      const start = parseDate(p.start);
      const end = parseDate(p.end);
      // `end` is the last occupied night (inclusive), so iterate through it.
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const s = toDateStr(d);
        if (p.kind === "block") {
          booked.add(s); // owner block — red + gated, like a booking
          labels.set(s, p.label || "Owner block");
        } else if (p.confirmed) {
          booked.add(s);
        } else {
          tentative.add(s);
        }
      }
    }
    return { bookedDates: booked, tentativeDates: tentative, blockLabels: labels };
  }, [periods]);

  function isBooked(s: string) { return bookedDates.has(s); }
  function isTentative(s: string) { return tentativeDates.has(s); }
  function isPast(d: Date) { return d < today; }
  function inRange(s: string) {
    return checkIn && checkOut ? s >= checkIn && s <= checkOut : false;
  }

  // True when any night in the selected range [checkIn, checkOut) is confirmed-booked.
  const selectionConflict = useMemo(() => {
    if (!checkIn || !checkOut) return false;
    for (let d = parseDate(checkIn); d < parseDate(checkOut); d.setDate(d.getDate() + 1)) {
      if (bookedDates.has(toDateStr(d))) return true;
    }
    return false;
  }, [checkIn, checkOut, bookedDates]);

  useEffect(() => {
    onConflictChange?.(selectionConflict);
  }, [selectionConflict, onConflictChange]);

  function handleClick(dateStr: string) {
    // Past dates stay locked unless allowPast is set; booked dates are intentionally
    // selectable so the admin can override and double-book.
    if (!allowPast && parseDate(dateStr) < today) return;

    if (!checkIn || (checkIn && checkOut)) {
      onChange({ checkIn: dateStr, checkOut: null });
      return;
    }
    if (dateStr < checkIn) {
      onChange({ checkIn: dateStr, checkOut: checkIn });
      return;
    }
    if (dateStr === checkIn) {
      onChange({ checkIn: null, checkOut: null });
      return;
    }
    // Complete the range even when it crosses booked nights — the overlap is
    // surfaced as a warning rather than blocked.
    onChange({ checkIn, checkOut: dateStr });
  }

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
            if (day === null) return <div key={`e-${i}`} className="h-9" />;
            const d = new Date(year, month, day);
            const dateStr = toDateStr(d);
            const booked = isBooked(dateStr);
            const tentative = isTentative(dateStr);
            const past = isPast(d);
            const lockedPast = past && !allowPast;
            const disabled = lockedPast || !lodgifyPropertyId;
            const inSel = inRange(dateStr);
            const start = checkIn === dateStr;
            const end = checkOut === dateStr;
            const edge = start || end;
            return (
              <button
                key={dateStr}
                type="button"
                disabled={disabled}
                onClick={() => handleClick(dateStr)}
                title={
                  blockLabels.has(dateStr)
                    ? `Blocked — ${blockLabels.get(dateStr)} (click to override)`
                    : booked
                      ? "Booked — click to override and create a double booking"
                      : tentative
                        ? "Unpaid hold — click to book anyway"
                        : undefined
                }
                className={[
                  "h-9 text-sm relative transition-colors",
                  lockedPast || !lodgifyPropertyId ? "text-muted-foreground/30 cursor-not-allowed" : "",
                  // Booked nights stay red so the overlap is always visible, even when selected.
                  booked && !past ? "bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400" : "",
                  tentative && !booked && !past ? "bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300" : "",
                  !disabled ? "hover:bg-primary/10 cursor-pointer" : "",
                  inSel && !edge && !booked ? "bg-primary/10" : "",
                  // Selection drawn as a primary ring over booked nights instead of a fill.
                  inSel && booked ? "ring-1 ring-inset ring-primary" : "",
                  edge && !booked ? "bg-primary text-primary-foreground" : "",
                  edge && booked ? "ring-2 ring-inset ring-primary font-semibold" : "",
                  start ? "rounded-l-md" : "",
                  end ? "rounded-r-md" : "",
                  start && !checkOut ? "rounded-md" : "",
                ].join(" ")}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  // When backfilling past stays, let the admin page back up to a year.
  const minMonth = allowPast ? addMonths(currentMonth, -12) : currentMonth;
  const maxMonth = addMonths(today, monthsToShow - monthsVisible);
  const visibleMonths = Array.from({ length: monthsVisible }, (_, i) => addMonths(viewMonth, i));

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setViewMonth(addMonths(viewMonth, -1))}
          disabled={viewMonth <= minMonth}
          className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setViewMonth(addMonths(viewMonth, 1))}
          disabled={viewMonth >= maxMonth}
          className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {!lodgifyPropertyId ? (
        <p className="text-sm text-muted-foreground text-center py-8">Select a property to see availability.</p>
      ) : loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {visibleMonths.map((m, i) => <div key={i}>{renderMonth(m)}</div>)}
        </div>
      )}

      {selectionConflict && (
        <div className="rounded-md border border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40 px-3 py-2 text-xs text-red-700 dark:text-red-300">
          These dates overlap an existing booking or block. You can still create this as a double booking.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-primary" />Selected</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-primary/10" />In range</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-red-100 dark:bg-red-950/40" />Booked (click to double-book)</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-amber-100 dark:bg-amber-950/40" />Tentative (clickable)</span>
      </div>
    </div>
  );
}
