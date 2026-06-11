import { stayIncludesHoliday } from "@/lib/holidays";

// Timing upsells (early check-in / late check-out) are billed per extra hour.
// $25/hr normally, $50/hr when the stay overlaps a US federal holiday.
// The only valid tiers are 1 or 2 extra hours.
export const STANDARD_HOURLY_CENTS = 2500;
export const HOLIDAY_HOURLY_CENTS = 5000;
export const VALID_TIMING_HOURS = [1, 2];

export function isTimingUpsell(type: string): boolean {
  return type === "early_checkin" || type === "late_checkout";
}

/** Per-extra-hour rate for timing upsells, given the stay dates. */
export function timingHourlyCents(checkIn: string, checkOut: string): number {
  return stayIncludesHoliday(checkIn, checkOut) ? HOLIDAY_HOURLY_CENTS : STANDARD_HOURLY_CENTS;
}

/**
 * Authoritative price for a timing-upsell tier, or null if the hours are invalid.
 */
export function timingUpsellPriceCents(
  hours: number,
  checkIn: string,
  checkOut: string
): number | null {
  if (!VALID_TIMING_HOURS.includes(hours)) return null;
  return timingHourlyCents(checkIn, checkOut) * hours;
}

type UpsellLike = {
  type: string;
  price_cents: number;
  meta?: Record<string, unknown> | null;
};

export const STANDARD_CHECKIN_TIME = "4:00 PM";
export const STANDARD_CHECKOUT_TIME = "11:00 AM";

const STANDARD_CHECKIN_HOUR = 16;
const STANDARD_CHECKOUT_HOUR = 11;

// Fixed-time products sold before hourly tiers existed; their entries have no
// meta.hours and usually embed the committed time in the label.
const LEGACY_EARLY_CHECKIN_TIME = "1:00 PM";
const LEGACY_LATE_CHECKOUT_TIME = "2:00 PM";

type TimingUpsellLike = {
  type: string;
  status?: string;
  label?: string;
  meta?: Record<string, unknown> | null;
};

function formatHour(hour24: number): string {
  const period = hour24 >= 12 ? "PM" : "AM";
  const h = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${h}:00 ${period}`;
}

function timeFromLabel(label: string | undefined): string | null {
  const match = label?.match(/\((\d{1,2}:\d{2}\s*[AP]M)\)/i);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Effective check-in/check-out times for a stay, accounting for paid
 * early check-in / late check-out upsells. Current purchases carry
 * meta.hours; legacy entries only embed the time in their label,
 * e.g. "Early Check-In (1:00 PM)".
 */
export function effectiveStayTimes(upsells: TimingUpsellLike[] | null | undefined): {
  checkInTime: string;
  checkOutTime: string;
  hasEarlyCheckin: boolean;
  hasLateCheckout: boolean;
} {
  const paid = (upsells ?? []).filter((u) => u.status === "paid");
  const early = paid.find((u) => u.type === "early_checkin");
  const late = paid.find((u) => u.type === "late_checkout");

  let checkInTime = STANDARD_CHECKIN_TIME;
  if (early) {
    const hours = Number((early.meta as { hours?: unknown } | null | undefined)?.hours);
    checkInTime = VALID_TIMING_HOURS.includes(hours)
      ? formatHour(STANDARD_CHECKIN_HOUR - hours)
      : timeFromLabel(early.label) ?? LEGACY_EARLY_CHECKIN_TIME;
  }

  let checkOutTime = STANDARD_CHECKOUT_TIME;
  if (late) {
    const hours = Number((late.meta as { hours?: unknown } | null | undefined)?.hours);
    checkOutTime = VALID_TIMING_HOURS.includes(hours)
      ? formatHour(STANDARD_CHECKOUT_HOUR + hours)
      : timeFromLabel(late.label) ?? LEGACY_LATE_CHECKOUT_TIME;
  }

  return { checkInTime, checkOutTime, hasEarlyCheckin: !!early, hasLateCheckout: !!late };
}

/**
 * {{check_in_time}} / {{check_out_time}} template vars for guest messages.
 * When a timing upsell is paid, the time carries a confirmation note so the
 * message can't be mistaken for the standard schedule.
 */
export function stayTimeVars(upsells: TimingUpsellLike[] | null | undefined): {
  check_in_time: string;
  check_out_time: string;
} {
  const t = effectiveStayTimes(upsells);
  return {
    check_in_time: t.hasEarlyCheckin ? `${t.checkInTime} (early check-in confirmed)` : t.checkInTime,
    check_out_time: t.hasLateCheckout ? `${t.checkOutTime} (late check-out confirmed)` : t.checkOutTime,
  };
}

/**
 * Server-side price enforcement for timing upsells. Recomputes the authoritative
 * price from (type, hours, stay dates) and rejects any client-supplied price that
 * doesn't match — preventing tampering with the holiday surcharge. Non-timing
 * upsells are ignored here. Returns an error message, or null if all valid.
 */
export function validateTimingUpsellPrices(
  items: UpsellLike[],
  checkIn: string,
  checkOut: string
): string | null {
  for (const item of items) {
    if (!isTimingUpsell(item.type)) continue;

    const hours = Number((item.meta as { hours?: unknown } | null | undefined)?.hours);
    const expected = timingUpsellPriceCents(hours, checkIn, checkOut);

    if (expected === null) {
      return `Invalid duration for ${item.type} (must be 1 or 2 hours).`;
    }
    if (item.price_cents !== expected) {
      return `Invalid price for ${item.type}.`;
    }
  }
  return null;
}
