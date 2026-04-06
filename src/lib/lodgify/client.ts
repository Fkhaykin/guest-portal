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
  pets: number;
  status: string;    // "Booked" | "Tentative" | "Cancelled" | "Declined" | "Open" | "CheckedOut"
  source: string | null;
  notes: string | null;
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
}

// --- API methods ---

export async function getProperties(): Promise<LodgifyProperty[]> {
  const data = await lodgifyFetch<{ items: Array<{ id: number; name: string; address?: string; description?: string }> }>("/v2/properties");
  return data.items.map((p) => ({
    id: p.id,
    name: p.name,
    address: p.address ?? null,
    description: p.description ?? null,
  }));
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

  const items: LodgifyBooking[] = data.items.map((b) => ({
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
    pets: b.total_guest_breakdown?.pets ?? b.rooms?.reduce((sum, r) => sum + (r.guest_breakdown?.pets || 0), 0) ?? 0,
    status: b.status,
    source: b.source,
    notes: b.notes,
  }));

  return { items, total: data.total };
}

export async function getBookingById(bookingId: number): Promise<LodgifyBooking> {
  const raw = await lodgifyFetch<{
    id: number;
    property_id: number;
    guest: { name: string; email: string | null; phone: string | null };
    arrival: string;
    departure: string;
    status: string;
    source: string | null;
    notes?: string | null;
    rooms?: Array<{
      people: number;
      guest_breakdown?: { adults: number; children: number; infants: number; pets: number };
    }>;
  }>(`/v2/reservations/bookings/${bookingId}`);

  return {
    id: raw.id,
    property_id: raw.property_id,
    guest: {
      id: "",
      name: raw.guest.name,
      email: raw.guest.email,
      phone: raw.guest.phone,
    },
    arrival: raw.arrival ?? "",
    departure: raw.departure ?? "",
    guests: raw.rooms?.reduce((sum, r) => sum + (r.people || 0), 0) ?? 1,
    pets: raw.rooms?.reduce((sum, r) => sum + (r.guest_breakdown?.pets || 0), 0) ?? 0,
    status: raw.status,
    source: raw.source,
    notes: raw.notes ?? null,
  };
}
