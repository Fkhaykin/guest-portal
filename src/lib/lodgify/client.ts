const LODGIFY_BASE_URL = "https://api.lodgify.com";

function getApiKey() {
  const key = process.env.LODGIFY_API_KEY;
  if (!key) throw new Error("LODGIFY_API_KEY is not set");
  return key;
}

async function lodgifyFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${LODGIFY_BASE_URL}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString(), {
    headers: {
      "X-ApiKey": getApiKey(),
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Lodgify API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// --- Types matching Lodgify API responses ---

export interface LodgifyProperty {
  id: number;
  name: string;
  address: string | null;
  description: string | null;
  imageUrl: string | null;
  maxGuests: number | null;
}

export interface LodgifyGuest {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

export interface LodgifyBooking {
  id: number;
  property_id: number;
  guest: LodgifyGuest;
  arrival: string;   // ISO date
  departure: string; // ISO date
  guests: number;
  adults: number;
  children: number;
  infants: number;
  pets: number;
  status: string;    // "Booked" | "Tentative" | "Cancelled" | "Declined" | "Open" | "CheckedOut"
  source: string | null;
  notes: string | null;
  total_amount: number | null;
  // True when total_amount is the gross figure (stay + fees + taxes) from the
  // v1 list endpoint, which has no subtotals breakdown. Revenue in the DB is
  // the rent-only subtotals.stay figure, so gross amounts must not overwrite it.
  total_amount_is_gross: boolean;
  date_created: string | null; // ISO datetime from Lodgify
  thread_uid: string | null;   // Messaging thread id (only present on v2 detail)
}

// v1 response shape
interface LodgifyV1BookingsResponse {
  items: LodgifyV1Booking[];
  total: number;
  next: string | null;
  previous: string | null;
}

interface LodgifyV1Booking {
  id: number;
  status: string;
  source: string | null;
  guest: {
    name: string;
    email: string | null;
    phone: string | null;
    id: string;
  };
  arrival: string | null;
  departure: string | null;
  property_id: number;
  total_guest_breakdown?: {
    adults: number;
    children: number;
    infants: number;
    pets: number;
  };
  rooms: Array<{
    people: number;
    guest_breakdown?: {
      adults: number;
      children: number;
      infants: number;
      pets: number;
    };
  }>;
  notes: string | null;
  total_amount?: number | null;
  amount?: number | null;
  total?: number | null;
  date_created?: string | null;
  created_at?: string | null;
}

// --- API methods ---

export async function getProperties(): Promise<LodgifyProperty[]> {
  const data = await lodgifyFetch<{ items: Array<{ id: number; name: string; address?: string; city?: string; state?: string; zip?: string; country?: string; description?: string; image_url?: string; images?: Array<{ url: string }> }> }>("/v2/properties");

  // Fetch room data for each property to get max_people (capacity)
  const properties = await Promise.all(
    data.items.map(async (p) => {
      let maxGuests: number | null = null;
      try {
        const rooms = await lodgifyFetch<{ max_people?: number }[]>(
          `/v2/properties/${p.id}/rooms`
        );
        maxGuests = rooms[0]?.max_people ?? null;
      } catch {
        // If rooms fetch fails, leave maxGuests null
      }
      return {
        id: p.id,
        name: p.name,
        address: [p.address, p.city, p.state, p.zip].filter(Boolean).join(", ") || null,
        description: p.description ?? null,
        imageUrl: p.image_url || p.images?.[0]?.url || null,
        maxGuests,
      };
    })
  );

  return properties;
}

/**
 * List bookings using v1 API (v2 list endpoint is unreliable).
 * Returns normalized LodgifyBooking objects.
 */
export async function getBookings(params?: {
  offset?: number;
  limit?: number;
  property_id?: number;
}): Promise<{ items: LodgifyBooking[]; total: number }> {
  const query: Record<string, string> = {};
  query.offset = String(params?.offset ?? 0);
  query.limit = String(params?.limit ?? 50);
  if (params?.property_id) query.house_id = String(params.property_id);

  const data = await lodgifyFetch<LodgifyV1BookingsResponse>("/v1/reservation", query);

  const items: LodgifyBooking[] = data.items.map((b) => {
    const totalBreakdown = b.total_guest_breakdown;
    const roomSum = (key: "adults" | "children" | "infants" | "pets") =>
      b.rooms?.reduce((sum, r) => sum + (r.guest_breakdown?.[key] || 0), 0) ?? 0;

    return {
      id: b.id,
      property_id: b.property_id,
      guest: {
        id: b.guest.id,
        name: b.guest.name,
        email: b.guest.email,
        phone: b.guest.phone,
      },
      arrival: b.arrival ?? "",
      departure: b.departure ?? "",
      guests: b.rooms?.reduce((sum, r) => sum + (r.people || 0), 0) ?? 1,
      adults: totalBreakdown?.adults ?? roomSum("adults"),
      children: totalBreakdown?.children ?? roomSum("children"),
      infants: totalBreakdown?.infants ?? roomSum("infants"),
      pets: totalBreakdown?.pets ?? roomSum("pets"),
      status: b.status,
      source: b.source,
      notes: b.notes,
      total_amount: b.total_amount ?? b.amount ?? b.total ?? null,
      total_amount_is_gross: true,
      date_created: b.created_at ?? b.date_created ?? null,
      thread_uid: null,
    };
  });

  return { items, total: data.total };
}

/**
 * Check availability for a property over a date range.
 * Returns an array of period objects with `start`, `end`, and `available` (0 = booked, 1 = available).
 */
export async function getAvailability(
  propertyId: number,
  start: string,
  end: string
): Promise<{ start: string; end: string; available: number }[]> {
  const data = await lodgifyFetch<
    { periods: { start: string; end: string; available: number }[] }[]
  >(`/v2/availability/${propertyId}`, { start, end });
  // Response is an array of room types; for whole-property rentals, take the first
  return data[0]?.periods ?? [];
}

/** Shift a YYYY-MM-DD date string by a number of days (UTC, TZ-safe). */
function shiftIsoDate(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/**
 * Check if a property is fully available for the given date range.
 *
 * A stay occupies the NIGHTS of [checkIn, checkOut) — the guest leaves on the
 * checkout morning, so the checkout day itself never needs to be free. Lodgify
 * availability periods are inclusive ranges of booked nights (a booking arriving
 * the 4th and departing the 7th reports nights 4–6 as `available: 0`), so we
 * query only through the last night (checkOut − 1). Querying through checkOut
 * would treat a same-day turnover — the next guest arriving on our checkout day —
 * as a conflict and wrongly report the property as unavailable.
 */
export async function isPropertyAvailable(
  propertyId: number,
  checkIn: string,
  checkOut: string
): Promise<boolean> {
  const lastNight = shiftIsoDate(checkOut, -1);
  // Guard against a zero-night range (checkOut <= checkIn); callers validate
  // this upstream, but never query Lodgify with an inverted window.
  if (lastNight < checkIn) return false;
  const periods = await getAvailability(propertyId, checkIn, lastNight);
  // Property is available if no night within the stay is booked
  return periods.every((p) => p.available === 1);
}

/**
 * Get a price quote for a property over a date range.
 * Fetches the room type ID first, then requests a quote with it.
 */
export async function getQuote(
  propertyId: number,
  arrival: string,
  departure: string,
  guests: number = 2
): Promise<{ total: number; roomRate: number | null; currency: string } | null> {
  try {
    // Get room type ID (required by Lodgify quote API)
    const rooms = await lodgifyFetch<{ id: number }[]>(
      `/v2/properties/${propertyId}/rooms`
    );
    const roomId = rooms[0]?.id;
    if (!roomId) return null;

    const data = await lodgifyFetch<
      {
        total_including_vat: number | null;
        total_excluding_vat: number;
        currency_code: string;
        room_types?: { price_types?: { type: number; subtotal: number }[] }[];
      }[]
    >(`/v2/quote/${propertyId}`, {
      arrival,
      departure,
      "roomTypes[0].id": String(roomId),
      "roomTypes[0].people": String(guests),
    });

    const quote = data[0];
    if (!quote) return null;

    // Lodgify breaks the quote into price_types: 0 = Room rate, 1 = Promotion,
    // 2 = Fees (cleaning etc.), 4 = Taxes. We want just the room rate so
    // callers that add their own fees + taxes don't double-count.
    const roomRateSubtotals = (quote.room_types ?? [])
      .flatMap((rt) => rt.price_types ?? [])
      .filter((p) => p.type === 0)
      .map((p) => p.subtotal);
    const roomRate = roomRateSubtotals.length
      ? roomRateSubtotals.reduce((a, b) => a + b, 0)
      : null;

    return {
      total: quote.total_including_vat ?? quote.total_excluding_vat,
      roomRate,
      currency: quote.currency_code,
    };
  } catch {
    return null;
  }
}

export async function getBookingById(bookingId: number): Promise<LodgifyBooking> {
  const raw = await lodgifyFetch<{
    id: number;
    property_id: number;
    guest: { id?: string; name: string; email: string | null; phone: string | null };
    arrival: string;
    departure: string;
    status: string;
    source: string | null;
    notes?: string | null;
    total_amount?: number | null;
    amount?: number | null;
    subtotals?: { stay?: number | null };
    created_at?: string | null;
    thread_uid?: string | null;
    rooms?: Array<{
      people: number;
      guest_breakdown?: { adults: number; children: number; infants: number; pets: number };
    }>;
  }>(`/v2/reservations/bookings/${bookingId}`);

  // Prefer subtotals.stay (rental amount excl. taxes/platform fees) over total_amount
  const stay = raw.subtotals?.stay;
  const resolvedAmount = (stay && stay > 0) ? stay : (raw.total_amount ?? raw.amount ?? null);

  const roomSum = (key: "adults" | "children" | "infants" | "pets") =>
    raw.rooms?.reduce((sum, r) => sum + (r.guest_breakdown?.[key] || 0), 0) ?? 0;

  return {
    id: raw.id,
    property_id: raw.property_id,
    guest: {
      id: raw.guest.id ?? "",
      name: raw.guest.name,
      email: raw.guest.email,
      phone: raw.guest.phone,
    },
    arrival: raw.arrival ?? "",
    departure: raw.departure ?? "",
    guests: raw.rooms?.reduce((sum, r) => sum + (r.people || 0), 0) ?? 1,
    adults: roomSum("adults"),
    children: roomSum("children"),
    infants: roomSum("infants"),
    pets: roomSum("pets"),
    status: raw.status,
    source: raw.source,
    notes: raw.notes ?? null,
    total_amount: resolvedAmount,
    total_amount_is_gross: !(stay && stay > 0),
    date_created: raw.created_at ?? null,
    thread_uid: raw.thread_uid ?? null,
  };
}

// --- Webhook management (Lodgify public API v1) ---
// Docs: https://docs.lodgify.com/reference/webhooks
// Endpoints:
//   POST /webhooks/v1/subscribe     { target_url, event }      → { id }
//   POST /webhooks/v1/unsubscribe   { id }                      → {}
//   GET  /webhooks/v1/list                                      → [{ id, event, target_url }]

export type LodgifyWebhookEvent =
  | "booking_new_any_status"
  | "booking_new_status_booked"
  | "booking_change"
  | "booking_status_change"
  | "rate_change"
  | "availability_change"
  | "guest_message_received";

export interface LodgifySubscription {
  id: number | string;
  event: string;
  target_url: string;
}

async function lodgifyPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${LODGIFY_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "X-ApiKey": getApiKey(),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Lodgify API error ${res.status}: ${text}`);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}

export async function listWebhookSubscriptions(): Promise<LodgifySubscription[]> {
  const data = await lodgifyFetch<LodgifySubscription[] | { items: LodgifySubscription[] }>(
    "/webhooks/v1/list"
  );
  return Array.isArray(data) ? data : data.items ?? [];
}

export async function subscribeWebhook(params: {
  event: LodgifyWebhookEvent | string;
  target_url: string;
}): Promise<{ id: number | string; secret?: string }> {
  return lodgifyPost<{ id: number | string; secret?: string }>("/webhooks/v1/subscribe", {
    event: params.event,
    target_url: params.target_url,
  });
}

export async function unsubscribeWebhook(id: number | string): Promise<void> {
  const res = await fetch(`${LODGIFY_BASE_URL}/webhooks/v1/unsubscribe`, {
    method: "DELETE",
    headers: {
      "X-ApiKey": getApiKey(),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ id }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Lodgify API error ${res.status}: ${text}`);
  }
}

/**
 * Fetch the first room type id for a Lodgify property. The v1 create-booking
 * endpoint requires every room in the payload to carry a valid room_type_id,
 * otherwise it rejects with error 905 ("You must define a rooms for the booking
 * with valid room type Id"). Our properties are single-unit, so the first room
 * is the one to book.
 */
export async function getRoomTypeId(propertyId: number): Promise<number> {
  const rooms = await lodgifyFetch<Array<{ id: number }>>(
    `/v2/properties/${propertyId}/rooms`
  );
  const roomTypeId = rooms?.[0]?.id;
  if (!roomTypeId) {
    throw new Error(`No room type found for Lodgify property ${propertyId}`);
  }
  return roomTypeId;
}

/**
 * Create a booking on Lodgify via the v1 API.
 * Returns the Lodgify booking ID on success.
 */
export async function createBooking(params: {
  propertyId: number;
  arrival: string;
  departure: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  guests: number;
  totalAmount: number;
  source: string;
}): Promise<number> {
  const url = `${LODGIFY_BASE_URL}/v1/reservation/booking`;
  const roomTypeId = await getRoomTypeId(params.propertyId);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "X-ApiKey": getApiKey(),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      property_id: params.propertyId,
      arrival: params.arrival,
      departure: params.departure,
      status: "Booked",
      source: params.source,
      guest: {
        name: params.guestName,
        email: params.guestEmail,
        phone: params.guestPhone,
      },
      rooms: [
        {
          room_type_id: roomTypeId,
          people: params.guests,
        },
      ],
      total_amount: params.totalAmount,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Lodgify create booking error ${res.status}: ${text}`);
  }

  // The live v1 endpoint returns the new booking id as a bare integer; older
  // docs imply { id }. Handle both so we always capture the id — without it the
  // local registration never gets linked, and the inbound webhook (which upserts
  // on lodgify_booking_id) creates a duplicate registration row instead of
  // matching the one we just pushed.
  const data: unknown = await res.json();
  const bookingId =
    typeof data === "number"
      ? data
      : (data as { id?: number; booking_id?: number; reservation_id?: number } | null)?.id ??
        (data as { booking_id?: number } | null)?.booking_id ??
        (data as { reservation_id?: number } | null)?.reservation_id;

  if (typeof bookingId !== "number") {
    throw new Error(`Lodgify create booking returned no id: ${JSON.stringify(data)}`);
  }

  return bookingId;
}
