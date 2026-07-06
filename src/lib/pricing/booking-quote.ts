import { getNightlyRates } from "@/lib/pricelabs/client";
import { getQuote } from "@/lib/lodgify/client";
import { computeQuoteFromRates, PA_STATE_TAX_RATE, MONROE_COUNTY_TAX_RATE } from "./quote-math";
import type { NightlyRate, QuoteBreakdown } from "./quote-math";

// Re-exported so existing consumers (extend-stay, checkout routes, etc.) keep
// their imports; the definitions now live in the client-safe quote-math module.
export { PA_STATE_TAX_RATE, MONROE_COUNTY_TAX_RATE };
export type { NightlyRate };
export type BookingQuoteBreakdown = QuoteBreakdown;

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

  return computeQuoteFromRates(nightlyRates, {
    cleaningFeeCents: input.cleaningFeeCents,
    petFeeCents: input.petFeeCents,
    pets: input.pets,
    discountCents: input.discountCents,
  });
}
