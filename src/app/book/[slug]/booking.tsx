"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Minus,
  PawPrint,
  Plus,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/* ------------------------------------------------------------------ */
/*  Date helpers                                                       */
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
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
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

function fmtShort(s: string) {
  return parseDate(s).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_HEADERS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/* ------------------------------------------------------------------ */
/*  Booking state — shared by calendar, booking card & mobile bar      */
/* ------------------------------------------------------------------ */

export function useBooking({
  lodgifyPropertyId,
  propertySlug,
  maxGuests,
  petsAllowed,
  initialCheckIn,
  initialCheckOut,
  initialGuests,
  initialPets,
}: {
  lodgifyPropertyId: number;
  propertySlug: string;
  maxGuests: number;
  petsAllowed: boolean;
  initialCheckIn?: string;
  initialCheckOut?: string;
  initialGuests?: string;
  initialPets?: string;
}) {
  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const validInitialCheckIn =
    initialCheckIn && parseDate(initialCheckIn) >= today ? initialCheckIn : null;

  const [checkIn, setCheckIn] = useState<string | null>(validInitialCheckIn);
  const [checkOut, setCheckOut] = useState<string | null>(
    validInitialCheckIn && initialCheckOut ? initialCheckOut : null
  );
  const [guests, setGuests] = useState(() => {
    const g = parseInt(initialGuests || "2", 10);
    return Number.isFinite(g) && g > 0 ? Math.min(g, maxGuests) : 2;
  });
  const [pets, setPets] = useState(() => {
    const p = parseInt(initialPets || "0", 10);
    return petsAllowed && Number.isFinite(p) && p > 0 ? Math.min(p, 4) : 0;
  });

  const [periods, setPeriods] = useState<AvailabilityPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  // Quote results are keyed by their request signature so a stale response
  // (or a cleared selection) never shows the wrong price.
  const [quoteResult, setQuoteResult] = useState<{
    key: string;
    data: { total: number; roomRate: number | null; currency: string } | null;
  } | null>(null);
  const [calendarPulse, setCalendarPulse] = useState(false);
  const pulseTimeout = useRef<ReturnType<typeof setTimeout>>(null);

  // 12 months of availability, sourced from our own DB
  useEffect(() => {
    const start = toDateStr(today);
    const end = toDateStr(addMonths(today, 12));
    fetch(`/api/availability/calendar?property_id=${lodgifyPropertyId}&start=${start}&end=${end}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.periods) setPeriods(data.periods);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [lodgifyPropertyId, today]);

  // Live price quote for the selected stay
  const quoteKey =
    checkIn && checkOut ? `${checkIn}|${checkOut}|${guests}` : null;
  useEffect(() => {
    if (!quoteKey || !checkIn || !checkOut) return;
    const controller = new AbortController();
    fetch(
      `/api/availability/quote?property_id=${lodgifyPropertyId}&arrival=${checkIn}&departure=${checkOut}&guests=${guests}`,
      { signal: controller.signal }
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setQuoteResult({ key: quoteKey, data: data?.total ? data : null });
      })
      .catch((e) => {
        if (e.name !== "AbortError") setQuoteResult({ key: quoteKey, data: null });
      });
    return () => controller.abort();
  }, [quoteKey, checkIn, checkOut, guests, lodgifyPropertyId]);

  const quote = quoteKey && quoteResult?.key === quoteKey ? quoteResult.data : null;
  const quoteLoading = !!quoteKey && quoteResult?.key !== quoteKey;

  // Keep the URL shareable/refreshable without re-rendering the route
  useEffect(() => {
    const url = new URL(window.location.href);
    if (checkIn && checkOut) {
      url.searchParams.set("check_in", checkIn);
      url.searchParams.set("check_out", checkOut);
    } else {
      url.searchParams.delete("check_in");
      url.searchParams.delete("check_out");
    }
    url.searchParams.set("guests", String(guests));
    if (pets > 0) url.searchParams.set("pets", String(pets));
    else url.searchParams.delete("pets");
    window.history.replaceState(null, "", url.toString());
  }, [checkIn, checkOut, guests, pets]);

  // Build a set of booked NIGHTS for fast lookup. Availability periods are
  // inclusive ranges of occupied nights (a booking arriving the 4th and
  // departing the 7th reports nights 4–6), so we iterate through `end`
  // inclusive. A stay only consumes the nights of [check-in, check-out) —
  // never the checkout day itself — so same-day turnover is allowed.
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

  function clearDates() {
    setCheckIn(null);
    setCheckOut(null);
  }

  function scrollToCalendar() {
    document.getElementById("availability")?.scrollIntoView({ behavior: "smooth", block: "start" });
    setCalendarPulse(true);
    if (pulseTimeout.current) clearTimeout(pulseTimeout.current);
    pulseTimeout.current = setTimeout(() => setCalendarPulse(false), 1600);
  }

  const nights = checkIn && checkOut ? getNightCount(checkIn, checkOut) : null;
  const checkoutUrl =
    checkIn && checkOut
      ? `/book/${propertySlug}/checkout?check_in=${checkIn}&check_out=${checkOut}&guests=${guests}&pets=${pets}`
      : null;

  return {
    today,
    checkIn,
    checkOut,
    guests,
    setGuests,
    pets,
    setPets,
    maxGuests,
    petsAllowed,
    loading,
    quote,
    quoteLoading,
    nights,
    checkoutUrl,
    calendarPulse,
    isNightBooked,
    rangeNightsFree,
    isPast,
    isSelectable,
    handleDateClick,
    clearDates,
    scrollToCalendar,
  };
}

export type BookingState = ReturnType<typeof useBooking>;

/* ------------------------------------------------------------------ */
/*  Availability calendar — two months, hover range preview            */
/* ------------------------------------------------------------------ */

export function AvailabilityCalendar({ booking }: { booking: BookingState }) {
  const {
    today, checkIn, checkOut, loading, calendarPulse,
    isPast, isSelectable, isNightBooked, rangeNightsFree, handleDateClick, clearDates, nights,
  } = booking;

  const currentMonth = useMemo(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
    [today]
  );
  const [viewMonth, setViewMonth] = useState(() => {
    if (checkIn) {
      const d = parseDate(checkIn);
      return d >= today ? new Date(d.getFullYear(), d.getMonth(), 1) : currentMonth;
    }
    return currentMonth;
  });
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  // The range to paint: a completed selection, or a live hover preview while
  // picking the checkout day.
  const previewEnd =
    checkIn && !checkOut && hoverDate && hoverDate > checkIn && rangeNightsFree(checkIn, hoverDate)
      ? hoverDate
      : null;
  const rangeStart = checkIn;
  const rangeEnd = checkOut ?? previewEnd;

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
        <div className="grid grid-cols-7">
          {DAY_HEADERS.map((d) => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1.5">
              {d}
            </div>
          ))}
          {cells.map((day, i) => {
            if (day === null) return <div key={`empty-${i}`} className="h-11" />;

            const d = new Date(year, month, day);
            const dateStr = toDateStr(d);
            const past = isPast(d);
            const disabled = !isSelectable(dateStr, d);
            const isStart = rangeStart === dateStr;
            const isEnd = rangeEnd === dateStr;
            const inRange =
              rangeStart && rangeEnd && dateStr > rangeStart && dateStr < rangeEnd;
            // Show the "booked" treatment only for occupied nights the guest
            // can't select right now and that aren't part of the current
            // selection — so a turnover checkout day reads as selectable.
            const booked = isNightBooked(dateStr) && disabled && !isStart && !isEnd && !inRange;
            const isToday = isSameDay(d, today);

            return (
              <button
                key={dateStr}
                disabled={disabled}
                onClick={() => handleDateClick(dateStr)}
                onMouseEnter={() => setHoverDate(dateStr)}
                onMouseLeave={() => setHoverDate(null)}
                className={`
                  h-11 text-sm relative transition-colors
                  ${past ? "text-muted-foreground/30 cursor-not-allowed" : ""}
                  ${booked && !past ? "text-muted-foreground/35 line-through cursor-not-allowed" : ""}
                  ${!disabled && !isStart && !isEnd ? "hover:bg-primary/10 cursor-pointer rounded-full" : ""}
                  ${inRange ? "bg-primary/10" : ""}
                  ${isStart ? "bg-primary text-primary-foreground font-semibold z-10" : ""}
                  ${isEnd ? "bg-primary text-primary-foreground font-semibold z-10" : ""}
                  ${isStart && rangeEnd ? "rounded-l-full" : ""}
                  ${isEnd ? "rounded-r-full" : ""}
                  ${isStart && !rangeEnd ? "rounded-full" : ""}
                  ${isToday && !isStart && !isEnd ? "font-bold" : ""}
                `}
              >
                {day}
                {isToday && !isStart && !isEnd && (
                  <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const nextMonth = addMonths(viewMonth, 1);
  const maxMonth = addMonths(today, 11);

  return (
    <div
      className={`rounded-2xl border bg-card p-5 sm:p-6 transition-shadow duration-500 ${
        calendarPulse ? "ring-2 ring-primary shadow-lg" : ""
      }`}
    >
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Header: selection state + month nav */}
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">
                {checkIn && checkOut
                  ? `${fmtShort(checkIn)} → ${fmtShort(checkOut)} · ${nights} night${nights !== 1 ? "s" : ""}`
                  : checkIn
                    ? "Select your check-out date"
                    : "Select your check-in date"}
              </p>
              {checkIn && (
                <button
                  onClick={clearDates}
                  className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  Clear dates
                </button>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setViewMonth(addMonths(viewMonth, -1))}
                disabled={viewMonth <= currentMonth}
                className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMonth(addMonths(viewMonth, 1))}
                disabled={viewMonth >= maxMonth}
                className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Two-month grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
            {renderMonth(viewMonth)}
            <div className="hidden sm:block">{renderMonth(nextMonth)}</div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-primary" /> Selected
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-primary/10" /> Your stay
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-muted-foreground/50 line-through">15</span> Booked
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Guest & pet steppers                                               */
/* ------------------------------------------------------------------ */

function Stepper({
  value,
  min,
  max,
  onChange,
  label,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="h-8 w-8 rounded-full border flex items-center justify-center hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        aria-label={`Decrease ${label}`}
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="w-6 text-center text-sm font-semibold tabular-nums">{value}</span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="h-8 w-8 rounded-full border flex items-center justify-center hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        aria-label={`Increase ${label}`}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Booking card — sticky desktop rail                                 */
/* ------------------------------------------------------------------ */

export function BookingCard({
  booking,
  minPrice,
}: {
  booking: BookingState;
  minPrice: number | null;
}) {
  const router = useRouter();
  const {
    checkIn, checkOut, guests, setGuests, pets, setPets, maxGuests, petsAllowed,
    quote, quoteLoading, nights, checkoutUrl, scrollToCalendar,
  } = booking;

  const nightly =
    quote?.roomRate && nights ? Math.round(quote.roomRate / nights) : null;
  const feesAndTaxes =
    quote && quote.roomRate !== null ? Math.round(quote.total - quote.roomRate) : null;

  return (
    <div className="rounded-2xl border bg-card shadow-xl shadow-black/6 p-5 space-y-4">
      {/* Price header */}
      <div className="flex items-baseline gap-1.5">
        {quote && nights ? (
          <>
            <span className="text-2xl font-bold tracking-tight">
              ${(nightly ?? Math.round(quote.total / nights)).toLocaleString()}
            </span>
            <span className="text-sm text-muted-foreground">/ night</span>
          </>
        ) : minPrice ? (
          <>
            <span className="text-sm text-muted-foreground">From</span>
            <span className="text-2xl font-bold tracking-tight">
              ${Math.round(minPrice).toLocaleString()}
            </span>
            <span className="text-sm text-muted-foreground">/ night</span>
          </>
        ) : (
          <span className="text-lg font-semibold">Add dates for pricing</span>
        )}
      </div>

      {/* Date fields — click to jump to the calendar */}
      <div className="grid grid-cols-2 rounded-xl border overflow-hidden">
        <button
          onClick={scrollToCalendar}
          className="p-3 text-left hover:bg-accent transition-colors border-r"
        >
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Check-in
          </p>
          <p className={`text-sm font-medium ${checkIn ? "" : "text-muted-foreground"}`}>
            {checkIn ? fmtShort(checkIn) : "Add date"}
          </p>
        </button>
        <button
          onClick={scrollToCalendar}
          className="p-3 text-left hover:bg-accent transition-colors"
        >
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Check-out
          </p>
          <p className={`text-sm font-medium ${checkOut ? "" : "text-muted-foreground"}`}>
            {checkOut ? fmtShort(checkOut) : "Add date"}
          </p>
        </button>
      </div>

      {/* Guests & pets */}
      <div className="rounded-xl border divide-y">
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-2.5">
            <Users className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Guests</p>
              <p className="text-xs text-muted-foreground">Up to {maxGuests}</p>
            </div>
          </div>
          <Stepper value={guests} min={1} max={maxGuests} onChange={setGuests} label="guests" />
        </div>
        {petsAllowed && (
          <div className="flex items-center justify-between p-3">
            <div className="flex items-center gap-2.5">
              <PawPrint className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Pets</p>
                <p className="text-xs text-muted-foreground">Dogs welcome</p>
              </div>
            </div>
            <Stepper value={pets} min={0} max={4} onChange={setPets} label="pets" />
          </div>
        )}
      </div>

      {/* Price breakdown */}
      {checkIn && checkOut && (
        <div className="space-y-2 text-sm">
          {quoteLoading ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-4 bg-muted rounded w-2/3" />
              <div className="h-4 bg-muted rounded w-1/2" />
            </div>
          ) : quote ? (
            <>
              {quote.roomRate !== null && nightly !== null && (
                <div className="flex justify-between text-muted-foreground">
                  <span>
                    ${nightly.toLocaleString()} × {nights} night{nights !== 1 ? "s" : ""}
                  </span>
                  <span>${Math.round(quote.roomRate).toLocaleString()}</span>
                </div>
              )}
              {feesAndTaxes !== null && feesAndTaxes > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Taxes &amp; fees</span>
                  <span>${feesAndTaxes.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold border-t pt-2">
                <span>Total</span>
                <span>${Math.round(quote.total).toLocaleString()}</span>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground text-xs">
              Live pricing unavailable right now — your total will be shown at checkout.
            </p>
          )}
        </div>
      )}

      <Button
        size="lg"
        className="w-full text-base font-semibold"
        disabled={!checkoutUrl}
        onClick={() => checkoutUrl && router.push(checkoutUrl)}
      >
        {checkIn && checkOut ? "Reserve" : "Select dates"}
      </Button>

      <div className="space-y-1.5 pt-1">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0" />
          Book direct — no platform service fees
        </p>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5 text-primary shrink-0" />
          You won&apos;t be charged yet
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Mobile booking bar — fixed to the bottom on small screens          */
/* ------------------------------------------------------------------ */

export function MobileBookingBar({
  booking,
  minPrice,
}: {
  booking: BookingState;
  minPrice: number | null;
}) {
  const router = useRouter();
  const { checkIn, checkOut, quote, quoteLoading, nights, checkoutUrl, scrollToCalendar } = booking;

  return (
    <div
      id="mobile-booking-bar"
      className="fixed bottom-0 inset-x-0 z-40 lg:hidden border-t bg-background/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          {checkIn && checkOut ? (
            <>
              <p className="text-sm font-bold">
                {quoteLoading ? (
                  <span className="text-muted-foreground font-normal">Fetching price…</span>
                ) : quote ? (
                  <>
                    ${Math.round(quote.total).toLocaleString()}
                    <span className="font-normal text-muted-foreground"> total</span>
                  </>
                ) : (
                  <>{nights} night{nights !== 1 ? "s" : ""}</>
                )}
              </p>
              <button
                onClick={scrollToCalendar}
                className="text-xs text-muted-foreground underline underline-offset-2"
              >
                {fmtShort(checkIn)} → {fmtShort(checkOut)}
              </button>
            </>
          ) : (
            <>
              <p className="text-sm font-bold">
                {minPrice ? (
                  <>
                    From ${Math.round(minPrice).toLocaleString()}
                    <span className="font-normal text-muted-foreground"> / night</span>
                  </>
                ) : (
                  "Plan your stay"
                )}
              </p>
              <p className="text-xs text-muted-foreground">Add dates for exact pricing</p>
            </>
          )}
        </div>
        <Button
          size="lg"
          className="shrink-0 font-semibold"
          onClick={() => {
            if (checkoutUrl) router.push(checkoutUrl);
            else scrollToCalendar();
          }}
        >
          {checkIn && checkOut ? "Reserve" : "Select dates"}
        </Button>
      </div>
    </div>
  );
}
