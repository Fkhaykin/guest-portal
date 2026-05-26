import { getNightlyRates } from "@/lib/pricelabs/client";
import { getQuote } from "@/lib/lodgify/client";

export const PA_STATE_TAX_RATE = 0.06;
export const MONROE_COUNTY_TAX_RATE = 0.03;

export type NightlyRate = { date: string; price_cents: number; min_stay: number };

export interface BookingQuoteInput {
  lodgifyPropertyId: number;
  checkIn: string;
  checkOut: string;
  guests: number;
  pets: number;
  cleaningFeeCents: number;
  petFeeCents: number;
  discountCents?: number;
}

export interface BookingQuoteBreakdown {
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

async function getLodgifyRoomId(lodgifyPropertyId: number): Promise<number | null> {
  const res = await fetch(
    `https://api.lodgify.com/v2/properties/${lodgifyPropertyId}/rooms`,
    { headers: { "X-ApiKey": process.env.LODGIFY_API_KEY!, Accept: "application/json" } }
  );
  if (!res.ok) return null;
  const rooms = (await res.json()) as { id: number }[];
  return rooms[0]?.id ?? null;
}

function dateOnly(iso: string) {
  return iso.slice(0, 10);
}

export async function buildBookingQuote(input: BookingQuoteInput): Promise<BookingQuoteBreakdown> {
  const nights = Math.round(
    (new Date(input.checkOut + "T00:00:00").getTime() -
      new Date(input.checkIn + "T00:00:00").getTime()) /
      86_400_000
  );
  if (nights <= 0) {
    throw new Error("Check-out must be after check-in");
  }

  const roomId = await getLodgifyRoomId(input.lodgifyPropertyId);
  let nightlyRates: NightlyRate[] = [];

  if (roomId) {
    try {
      nightlyRates = await getNightlyRates(input.lodgifyPropertyId, roomId, input.checkIn, input.checkOut);
    } catch {
      // PriceLabs didn't return rates (e.g. listing not configured there).
      // Fall back to Lodgify, but use the ROOM RATE subtotal — not total —
      // so we don't double-count cleaning fees and taxes which we add below.
      const quote = await getQuote(input.lodgifyPropertyId, input.checkIn, input.checkOut, input.guests);
      const roomDollars = quote?.roomRate ?? null;
      if (roomDollars !== null) {
        const avg = Math.round(Math.round(roomDollars * 100) / nights);
        const d = new Date(input.checkIn + "T00:00:00");
        for (let i = 0; i < nights; i++) {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          nightlyRates.push({ date: `${y}-${m}-${day}`, price_cents: avg, min_stay: 1 });
          d.setDate(d.getDate() + 1);
        }
      }
    }
  }

  if (nightlyRates.length === 0) {
    throw new Error("Unable to fetch pricing for these dates");
  }

  // Normalize to date-only strings.
  nightlyRates = nightlyRates.map((r) => ({ ...r, date: dateOnly(r.date) }));

  const roomRateCents = nightlyRates.reduce((sum, r) => sum + r.price_cents, 0);
  const petFeeTotalCents = Math.max(0, input.pets) * input.petFeeCents;
  const stateTaxCents = Math.round(roomRateCents * PA_STATE_TAX_RATE);
  const countyTaxCents = Math.round(roomRateCents * MONROE_COUNTY_TAX_RATE);
  const taxTotalCents = stateTaxCents + countyTaxCents;

  const subtotal = roomRateCents + input.cleaningFeeCents + petFeeTotalCents + taxTotalCents;
  const rawDiscount = Math.max(0, input.discountCents ?? 0);
  const discountCents = Math.min(rawDiscount, subtotal);
  const totalCents = subtotal - discountCents;

  return {
    nightlyRates,
    nights,
    roomRateCents,
    cleaningFeeCents: input.cleaningFeeCents,
    petFeeTotalCents,
    stateTaxCents,
    countyTaxCents,
    taxTotalCents,
    discountCents,
    totalCents,
  };
}
