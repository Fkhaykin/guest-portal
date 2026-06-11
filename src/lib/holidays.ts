// US federal holidays — used to apply holiday pricing to timing upsells
// (early check-in / late check-out). A date is treated as a holiday if it is
// the nominal date OR the federally-observed (weekend-shifted) date.

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function iso(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

// nth occurrence of a weekday in a month, e.g. 3rd Monday (weekday 0=Sun..6=Sat)
function nthWeekday(year: number, month: number, weekday: number, n: number): string {
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const day = 1 + ((weekday - firstDow + 7) % 7) + (n - 1) * 7;
  return iso(year, month, day);
}

// last occurrence of a weekday in a month, e.g. last Monday of May
function lastWeekday(year: number, month: number, weekday: number): string {
  const last = new Date(Date.UTC(year, month, 0)); // day 0 of next month = last day of this one
  const day = last.getUTCDate() - ((last.getUTCDay() - weekday + 7) % 7);
  return iso(year, month, day);
}

// A fixed-date holiday plus its observed date (Sat → Fri, Sun → Mon).
function fixed(year: number, month: number, day: number): string[] {
  const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const dates = [iso(year, month, day)];
  if (dow === 6) {
    const f = new Date(Date.UTC(year, month - 1, day - 1));
    dates.push(iso(f.getUTCFullYear(), f.getUTCMonth() + 1, f.getUTCDate()));
  } else if (dow === 0) {
    const m = new Date(Date.UTC(year, month - 1, day + 1));
    dates.push(iso(m.getUTCFullYear(), m.getUTCMonth() + 1, m.getUTCDate()));
  }
  return dates;
}

function holidaysForYear(year: number): Set<string> {
  return new Set([
    ...fixed(year, 1, 1),        // New Year's Day
    nthWeekday(year, 1, 1, 3),   // MLK Day — 3rd Mon Jan
    nthWeekday(year, 2, 1, 3),   // Presidents' Day — 3rd Mon Feb
    lastWeekday(year, 5, 1),     // Memorial Day — last Mon May
    ...fixed(year, 6, 19),       // Juneteenth
    ...fixed(year, 7, 4),        // Independence Day
    nthWeekday(year, 9, 1, 1),   // Labor Day — 1st Mon Sep
    nthWeekday(year, 10, 1, 2),  // Columbus Day — 2nd Mon Oct
    ...fixed(year, 11, 11),      // Veterans Day
    nthWeekday(year, 11, 4, 4),  // Thanksgiving — 4th Thu Nov
    ...fixed(year, 12, 25),      // Christmas Day
  ]);
}

const cache = new Map<number, Set<string>>();
function holidaySet(year: number): Set<string> {
  let set = cache.get(year);
  if (!set) {
    set = holidaysForYear(year);
    cache.set(year, set);
  }
  return set;
}

/** True if the given YYYY-MM-DD is a US federal holiday (nominal or observed). */
export function isHoliday(dateStr: string): boolean {
  const year = Number(dateStr.slice(0, 4));
  if (!year) return false;
  return holidaySet(year).has(dateStr);
}

/**
 * True if any date in the inclusive range [checkIn, checkOut] is a holiday —
 * i.e. the stay overlaps a holiday. Dates are YYYY-MM-DD.
 */
export function stayIncludesHoliday(checkIn: string, checkOut: string): boolean {
  if (!checkIn || !checkOut) return false;
  const end = new Date(checkOut + "T00:00:00");
  for (const d = new Date(checkIn + "T00:00:00"); d <= end; d.setDate(d.getDate() + 1)) {
    if (isHoliday(iso(d.getFullYear(), d.getMonth() + 1, d.getDate()))) return true;
  }
  return false;
}
