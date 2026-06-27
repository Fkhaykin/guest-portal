"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

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

function addMonths(d: Date, n: number) {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

interface Props {
  // Occupied nights as YYYY-MM-DD strings (a booking [check-in, check-out)).
  bookedDates: string[];
  monthsToShow?: number; // navigable range from this month (default 12)
  monthsVisible?: number; // months rendered side-by-side (default 2)
}

// Read-only availability calendar for contractors: occupied nights are shaded,
// open nights are left clear. No selection or interaction beyond month paging.
export function ServiceCalendar({
  bookedDates,
  monthsToShow = 12,
  monthsVisible = 2,
}: Props) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const bookedSet = useMemo(() => new Set(bookedDates), [bookedDates]);
  const [viewMonth, setViewMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );

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
            <div
              key={d}
              className="text-center text-xs font-medium text-muted-foreground py-1.5"
            >
              {d}
            </div>
          ))}
          {cells.map((day, i) => {
            if (day === null) return <div key={`e-${i}`} className="h-9" />;
            const d = new Date(year, month, day);
            const dateStr = toDateStr(d);
            const past = d < today;
            const booked = bookedSet.has(dateStr);
            return (
              <div
                key={dateStr}
                className={[
                  "h-9 flex items-center justify-center text-sm transition-colors",
                  past ? "text-muted-foreground/30" : "",
                  booked && !past
                    ? "bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 font-medium"
                    : "",
                ].join(" ")}
              >
                {day}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const maxMonth = addMonths(today, monthsToShow - monthsVisible);
  const visibleMonths = Array.from({ length: monthsVisible }, (_, i) =>
    addMonths(viewMonth, i)
  );

  return (
    <div className="rounded-2xl border bg-card p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setViewMonth(addMonths(viewMonth, -1))}
          disabled={viewMonth <= currentMonth}
          aria-label="Previous month"
          className="h-8 w-8 rounded-md flex items-center justify-center hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setViewMonth(addMonths(viewMonth, 1))}
          disabled={viewMonth >= maxMonth}
          aria-label="Next month"
          className="h-8 w-8 rounded-md flex items-center justify-center hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {visibleMonths.map((m, i) => (
          <div key={i}>{renderMonth(m)}</div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-3 border-t">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm border bg-card" />
          Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-red-100 dark:bg-red-950/40" />
          Booked
        </span>
      </div>
    </div>
  );
}
