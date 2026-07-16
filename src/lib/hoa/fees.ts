// HOA registration fee — a per-booking cost the HOA charges us to register each
// guest stay (COGS). The fee can escalate for "last-minute" bookings that land
// close to check-in.
//
// Per-property overrides live on the `property` table (hoa_registration_fee_cents,
// hoa_last_minute_fee_cents, hoa_last_minute_days); any NULL falls back to the
// per-HOA default below. This keeps NULL meaning "use the HOA default" so new
// houses resolve correctly without a data backfill.

export type HoaFeeDefault = {
  registrationFeeCents: number;
  // null => flat fee: no last-minute surcharge, always charge the base fee.
  lastMinuteFeeCents: number | null;
  lastMinuteDays: number;
};

// Defaults keyed by property.hoa_type.
export const HOA_FEE_DEFAULTS: Record<string, HoaFeeDefault> = {
  // Penn Estates (PEPOA): $45 per booking, $70 if booked within 3 days of check-in.
  pepoa: { registrationFeeCents: 4500, lastMinuteFeeCents: 7000, lastMinuteDays: 3 },
  // Blue Mountain Lake (BMLC): flat $140 per booking, no last-minute surcharge.
  bmlc: { registrationFeeCents: 14000, lastMinuteFeeCents: null, lastMinuteDays: 3 },
};

export const FALLBACK_HOA_FEE: HoaFeeDefault = HOA_FEE_DEFAULTS.pepoa;

export function hoaFeeDefaults(hoaType: string | null | undefined): HoaFeeDefault {
  return HOA_FEE_DEFAULTS[hoaType ?? "pepoa"] ?? FALLBACK_HOA_FEE;
}

export type HoaFeeOverrides = {
  registrationFeeCents?: number | null;
  lastMinuteFeeCents?: number | null;
  lastMinuteDays?: number | null;
};

export type ResolvedHoaFeeConfig = {
  registrationFeeCents: number;
  lastMinuteFeeCents: number | null;
  lastMinuteDays: number;
};

// Merge stored per-property overrides over the HOA default. A NULL override
// means "not configured — use the HOA default" (so an untouched Penn Estates
// house still resolves to its $70 last-minute fee, and BMLC to its flat $140).
// To make a property flat despite an HOA that has a surcharge, set the
// last-minute fee equal to the base fee.
export function resolveHoaFeeConfig(
  hoaType: string | null | undefined,
  overrides: HoaFeeOverrides
): ResolvedHoaFeeConfig {
  const d = hoaFeeDefaults(hoaType);
  return {
    registrationFeeCents: overrides.registrationFeeCents ?? d.registrationFeeCents,
    lastMinuteFeeCents: overrides.lastMinuteFeeCents ?? d.lastMinuteFeeCents,
    lastMinuteDays: overrides.lastMinuteDays ?? d.lastMinuteDays,
  };
}

// Whole days between the booking timestamp and the check-in date. Positive means
// the booking was made that many days before check-in; 0 or negative means
// same-day or after (always last-minute). Null when the booking date is unknown.
export function daysBeforeCheckIn(
  bookedAt: string | null | undefined,
  checkInDate: string | null | undefined
): number | null {
  if (!bookedAt || !checkInDate) return null;
  const booked = new Date(bookedAt).getTime();
  // Anchor check-in at local midnight so the comparison is a clean day count.
  const checkIn = new Date(`${checkInDate}T00:00:00`).getTime();
  if (Number.isNaN(booked) || Number.isNaN(checkIn)) return null;
  return Math.floor((checkIn - booked) / 86_400_000);
}

export type ComputedHoaFee = {
  feeCents: number;
  isLastMinute: boolean;
  baseFeeCents: number;
  lastMinuteFeeCents: number | null;
  lastMinuteDays: number;
  daysBeforeCheckIn: number | null;
};

// The effective HOA registration fee for one booking: the base fee, escalated to
// the last-minute fee when the booking landed within the window before check-in.
// A null last-minute fee (e.g. BMLC) means a flat fee regardless of timing.
export function computeHoaRegistrationFee(args: {
  hoaType: string | null | undefined;
  overrides: HoaFeeOverrides;
  bookedAt: string | null | undefined;
  checkInDate: string | null | undefined;
}): ComputedHoaFee {
  const cfg = resolveHoaFeeConfig(args.hoaType, args.overrides);
  const daysBefore = daysBeforeCheckIn(args.bookedAt, args.checkInDate);
  const isLastMinute =
    cfg.lastMinuteFeeCents != null &&
    daysBefore != null &&
    daysBefore <= cfg.lastMinuteDays;
  return {
    feeCents: isLastMinute ? cfg.lastMinuteFeeCents! : cfg.registrationFeeCents,
    isLastMinute,
    baseFeeCents: cfg.registrationFeeCents,
    lastMinuteFeeCents: cfg.lastMinuteFeeCents,
    lastMinuteDays: cfg.lastMinuteDays,
    daysBeforeCheckIn: daysBefore,
  };
}
