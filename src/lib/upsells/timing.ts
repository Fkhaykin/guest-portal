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
