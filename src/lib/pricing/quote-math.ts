// Pure pricing math shared between the server (authoritative re-quote) and the
// admin client (live recompute as rates are edited). This module has NO server
// imports (no fetch, no env, no PriceLabs/Lodgify) so it is safe to import into
// client components as well as API routes.

export const PA_STATE_TAX_RATE = 0.06;
export const MONROE_COUNTY_TAX_RATE = 0.03;

export interface NightlyRate {
  date: string;
  price_cents: number;
  min_stay: number;
}

export interface QuoteBreakdown {
  nightlyRates: NightlyRate[];
  nights: number;
  roomRateCents: number;
  cleaningFeeCents: number;
  petFeeTotalCents: number;
  stateTaxCents: number;
  countyTaxCents: number;
  taxTotalCents: number;
  discountCents: number;
  totalCents: number;
}

export interface QuoteMathOptions {
  cleaningFeeCents: number;
  petFeeCents: number; // flat fee charged once when pets > 0
  pets: number;
  discountCents?: number;
}

/**
 * Build a full booking breakdown from a set of nightly room rates. Taxes are
 * applied to the room subtotal; the pet fee is a single flat charge; the
 * discount is clamped to the subtotal. This is the single source of truth for
 * booking totals — buildBookingQuote() calls it after fetching engine rates,
 * and the admin New Booking form calls it to recompute when rates are overridden.
 */
export function computeQuoteFromRates(
  nightlyRates: NightlyRate[],
  opts: QuoteMathOptions
): QuoteBreakdown {
  const roomRateCents = nightlyRates.reduce((sum, r) => sum + r.price_cents, 0);
  const petFeeTotalCents = opts.pets > 0 ? opts.petFeeCents : 0;
  const stateTaxCents = Math.round(roomRateCents * PA_STATE_TAX_RATE);
  const countyTaxCents = Math.round(roomRateCents * MONROE_COUNTY_TAX_RATE);
  const taxTotalCents = stateTaxCents + countyTaxCents;

  const subtotal = roomRateCents + opts.cleaningFeeCents + petFeeTotalCents + taxTotalCents;
  const rawDiscount = Math.max(0, opts.discountCents ?? 0);
  const discountCents = Math.min(rawDiscount, subtotal);
  const totalCents = subtotal - discountCents;

  return {
    nightlyRates,
    nights: nightlyRates.length,
    roomRateCents,
    cleaningFeeCents: opts.cleaningFeeCents,
    petFeeTotalCents,
    stateTaxCents,
    countyTaxCents,
    taxTotalCents,
    discountCents,
    totalCents,
  };
}

/**
 * Enumerate the occupied nights of a stay: check-in through the night before
 * check-out (checkout day is not charged). Dates are ISO yyyy-mm-dd strings.
 */
export function nightsOfStay(checkIn: string, checkOut: string): string[] {
  const out: string[] = [];
  const d = new Date(checkIn + "T00:00:00Z");
  const end = new Date(checkOut + "T00:00:00Z");
  while (d < end) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}
