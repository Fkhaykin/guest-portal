import { NextResponse } from "next/server";

// Lodgify availability response shape (only the bits we need).
interface LodgifyPeriod {
  start: string;
  end: string;
  available: number;
  bookings?: { id: number; status: string | null }[];
}

// Enriched shape returned to the client.
export interface CalendarPeriod {
  start: string;
  end: string;
  available: number; // 0 = blocked, 1 = open
  // When `available: 0`, indicates whether the block is a confirmed booking
  // (red) or a tentative hold (amber). null when not relevant (open periods).
  confirmed: boolean | null;
}

const CONFIRMED_STATUSES = new Set(["Booked", "Confirmed", "CheckedIn", "CheckedOut"]);

async function fetchBookingStatus(id: number, apiKey: string): Promise<string | null> {
  try {
    const r = await fetch(`https://api.lodgify.com/v2/reservations/bookings/${id}`, {
      headers: { "X-ApiKey": apiKey, Accept: "application/json" },
    });
    if (!r.ok) return null;
    const data = (await r.json()) as { status?: string };
    return data.status ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const propertyId = searchParams.get("property_id");
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!propertyId || !start || !end) {
    return NextResponse.json(
      { error: "property_id, start, and end are required" },
      { status: 400 }
    );
  }

  const apiKey = process.env.LODGIFY_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ periods: [] });
  }

  try {
    const url = `https://api.lodgify.com/v2/availability/${propertyId}?start=${start}&end=${end}`;
    const res = await fetch(url, { headers: { "X-ApiKey": apiKey, Accept: "application/json" } });
    if (!res.ok) return NextResponse.json({ periods: [] });
    const data = (await res.json()) as { periods?: LodgifyPeriod[] }[];
    const raw = data[0]?.periods ?? [];

    // Collect unique booking IDs from blocked periods so we can look up
    // their statuses in parallel (Lodgify's availability response doesn't
    // include booking status — we have to fetch each separately).
    const ids = new Set<number>();
    for (const p of raw) {
      if (p.available === 0) for (const b of p.bookings ?? []) ids.add(b.id);
    }
    const statusEntries = await Promise.all(
      Array.from(ids).map(async (id) => [id, await fetchBookingStatus(id, apiKey)] as const)
    );
    const statusById = new Map(statusEntries);

    const periods: CalendarPeriod[] = raw.map((p) => {
      if (p.available !== 0) {
        return { start: p.start, end: p.end, available: p.available, confirmed: null };
      }
      const isConfirmed = (p.bookings ?? []).some((b) => {
        const status = statusById.get(b.id);
        return status !== null && status !== undefined && CONFIRMED_STATUSES.has(status);
      });
      return { start: p.start, end: p.end, available: 0, confirmed: isConfirmed };
    });

    return NextResponse.json({ periods });
  } catch {
    return NextResponse.json({ periods: [] });
  }
}
