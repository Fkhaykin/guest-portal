"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

type AvailabilityPeriod = { start: string; end: string; available: number };

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
  monthsToShow?: number;       // calendar fetch window (default 12)
  monthsVisible?: number;      // months rendered side-by-side (default 2)
}

// Two-month calendar with Lodgify availability shaded as booked.
// Selecting a check-in starts a range; selecting check-out before check-in restarts.
// If a range crosses booked dates, we restart the selection from the new click.
export function BookingDatePicker({
  lodgifyPropertyId,
  checkIn,
  checkOut,
  onChange,
  monthsToShow = 12,
  monthsVisible = 2,
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

  function isBooked(s: string) { return bookedDates.has(s); }
  function isPast(d: Date) { return d < today; }
  function inRange(s: string) {
    return checkIn && checkOut ? s >= checkIn && s <= checkOut : false;
  }

  function handleClick(dateStr: string) {
    if (isBooked(dateStr) || parseDate(dateStr) < today) return;

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
    // Range conflict check
    const start = parseDate(checkIn);
    const end = parseDate(dateStr);
    let conflict = false;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (isBooked(toDateStr(d))) { conflict = true; break; }
    }
    if (conflict) onChange({ checkIn: dateStr, checkOut: null });
    else onChange({ checkIn, checkOut: dateStr });
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
            const past = isPast(d);
            const disabled = booked || past || !lodgifyPropertyId;
            const inSel = inRange(dateStr);
            const start = checkIn === dateStr;
            const end = checkOut === dateStr;
            return (
              <button
                key={dateStr}
                type="button"
                disabled={disabled}
                onClick={() => handleClick(dateStr)}
                className={[
                  "h-9 text-sm relative transition-colors",
                  past || !lodgifyPropertyId ? "text-muted-foreground/30 cursor-not-allowed" : "",
                  booked && !past ? "bg-red-100 dark:bg-red-950/40 text-red-400 dark:text-red-500 cursor-not-allowed line-through" : "",
                  !disabled ? "hover:bg-primary/10 cursor-pointer" : "",
                  inSel && !start && !end ? "bg-primary/10" : "",
                  start ? "bg-primary text-primary-foreground rounded-l-md" : "",
                  end ? "bg-primary text-primary-foreground rounded-r-md" : "",
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
  const maxMonth = addMonths(today, monthsToShow - monthsVisible);
  const visibleMonths = Array.from({ length: monthsVisible }, (_, i) => addMonths(viewMonth, i));

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setViewMonth(addMonths(viewMonth, -1))}
          disabled={viewMonth <= currentMonth}
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

      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-primary" />Selected</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-primary/10" />In range</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-red-100 dark:bg-red-950/40" />Booked</span>
      </div>
    </div>
  );
}
