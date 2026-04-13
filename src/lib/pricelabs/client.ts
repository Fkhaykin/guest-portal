const PRICELABS_BASE_URL = "https://api.pricelabs.co";

function getApiKey() {
  const key = process.env.PRICELABS_API_KEY;
  if (!key) throw new Error("PRICELABS_API_KEY is not set");
  return key;
}

export interface NightlyRate {
  date: string;
  price_cents: number;
  min_stay: number;
}

/**
 * Fetch per-night dynamic rates from PriceLabs.
 * Listing ID format: "{lodgifyPropertyId}___{lodgifyRoomId}"
 * Returns rates for check-in through day-before-checkout.
 */
export async function getNightlyRates(
  lodgifyPropertyId: number,
  lodgifyRoomId: number,
  checkIn: string,
  checkOut: string
): Promise<NightlyRate[]> {
  const listingId = `${lodgifyPropertyId}___${lodgifyRoomId}`;

  const res = await fetch(`${PRICELABS_BASE_URL}/v1/listing_prices`, {
    method: "POST",
    headers: {
      "X-API-Key": getApiKey(),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      listings: [
        {
          id: listingId,
          pms: "lodgify",
          dateFrom: checkIn,
          dateTo: checkOut,
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PriceLabs API error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as {
    id: string;
    data: { date: string; price: number; min_stay: number }[];
    error_status?: string;
  }[];

  const listing = data[0];
  if (!listing || listing.error_status) {
    throw new Error(
      `PriceLabs error for ${listingId}: ${listing?.error_status || "no data"}`
    );
  }

  // Filter to check-in through day-before-checkout (checkout day is not charged)
  return listing.data
    .filter((d) => d.date >= checkIn && d.date < checkOut)
    .map((d) => ({
      date: d.date,
      price_cents: Math.round(d.price * 100),
      min_stay: d.min_stay,
    }));
}
