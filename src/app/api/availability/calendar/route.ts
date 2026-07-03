import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// A blocked span returned to the client. `end` is the LAST occupied night
// (inclusive) — the same convention Lodgify used, so existing consumers that
// expand nights through `end` keep working. Open days are simply absent.
export interface CalendarPeriod {
  start: string;
  end: string;
  available: number; // always 0 here — only blocked spans are emitted
  // false = tentative (amber): an unpaid hold, which is always one of our own
  // direct/admin bookings. true = booked (red, gated): a confirmed reservation
  // (OTA channel or paid) or a manual owner block.
  confirmed: boolean;
  kind: "booking" | "block";
  label?: string; // human note for blocks (the reason)
}

/** Shift a YYYY-MM-DD date by whole days (UTC, DST-safe). */
function shiftIsoDate(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/**
 * Fetch per-date minimum stays and nightly prices from Lodgify's rates
 * calendar. Runs alongside the DB queries and is fully failure-tolerant: any
 * error, non-OK response, or a stall past the ~4s budget returns null and the
 * fields are simply omitted. `minStays` maps arrival date → min nights for
 * stays starting that date; `defaultMinStay` is the most common value across
 * the window; `nightlyPrices` maps date → that night's rack rate, letting the
 * booking card itemize a stay night by night.
 */
// Successful Lodgify responses are cached for an hour by fetch revalidation,
// but failures are not — during a Lodgify-degraded window every request would
// otherwise re-attempt both calls and hold the response up to the 4s budget.
// Back off per property for a minute after a miss instead.
const minStayFailureAt = new Map<number, number>();
const MIN_STAY_FAILURE_BACKOFF_MS = 60_000;

async function fetchMinStays(
  lodgifyId: number,
  start: string,
  end: string
): Promise<{
  minStays: Record<string, number>;
  defaultMinStay: number;
  nightlyPrices: Record<string, number>;
} | null> {
  const apiKey = process.env.LODGIFY_API_KEY;
  if (!apiKey) return null;

  const failedAt = minStayFailureAt.get(lodgifyId);
  if (failedAt && Date.now() - failedAt < MIN_STAY_FAILURE_BACKOFF_MS) return null;

  const result = await fetchMinStaysFromLodgify(lodgifyId, start, end, apiKey);
  if (result) minStayFailureAt.delete(lodgifyId);
  else minStayFailureAt.set(lodgifyId, Date.now());
  return result;
}

async function fetchMinStaysFromLodgify(
  lodgifyId: number,
  start: string,
  end: string,
  apiKey: string
): Promise<{
  minStays: Record<string, number>;
  defaultMinStay: number;
  nightlyPrices: Record<string, number>;
} | null> {
  try {
    // One budget for both requests — availability must never wait on Lodgify.
    const signal = AbortSignal.timeout(4000);
    const headers = { "X-ApiKey": apiKey, Accept: "application/json" };

    const roomsRes = await fetch(`https://api.lodgify.com/v2/properties/${lodgifyId}/rooms`, {
      headers,
      signal,
      next: { revalidate: 3600 },
    });
    if (!roomsRes.ok) return null;
    const rooms = (await roomsRes.json()) as { id?: number }[];
    const roomId = rooms?.[0]?.id;
    if (!roomId) return null;

    const ratesUrl = new URL("https://api.lodgify.com/v2/rates/calendar");
    ratesUrl.searchParams.set("RoomTypeId", String(roomId));
    ratesUrl.searchParams.set("HouseId", String(lodgifyId));
    ratesUrl.searchParams.set("StartDate", start);
    ratesUrl.searchParams.set("EndDate", end);
    const ratesRes = await fetch(ratesUrl.toString(), {
      headers,
      signal,
      next: { revalidate: 3600 },
    });
    if (!ratesRes.ok) return null;
    const rates = (await ratesRes.json()) as {
      calendar_items?: {
        date?: string;
        prices?: { min_stay?: number; price_per_day?: number }[];
      }[];
    };

    const minStays: Record<string, number> = {};
    const nightlyPrices: Record<string, number> = {};
    const counts = new Map<number, number>();
    for (const item of rates.calendar_items ?? []) {
      const minStay = item.prices?.[0]?.min_stay;
      const pricePerDay = item.prices?.[0]?.price_per_day;
      if (item.date && typeof pricePerDay === "number" && pricePerDay > 0)
        nightlyPrices[item.date] = pricePerDay;
      if (!item.date || typeof minStay !== "number") continue;
      minStays[item.date] = minStay;
      counts.set(minStay, (counts.get(minStay) ?? 0) + 1);
    }
    if (!Object.keys(minStays).length) return null;

    let defaultMinStay = 1;
    let bestCount = 0;
    for (const [value, count] of counts) {
      if (count > bestCount) {
        bestCount = count;
        defaultMinStay = value;
      }
    }
    return { minStays, defaultMinStay, nightlyPrices };
  } catch {
    return null;
  }
}

/**
 * Blocked spans sourced entirely from our own database — the bookings Lodgify
 * channel-syncs into `registration` (Airbnb/VRBO/etc.), our direct bookings,
 * and manual owner blocks. No live Lodgify calls here, so this never stalls
 * on Lodgify's rate limit.
 */
async function loadPeriods(
  admin: ReturnType<typeof createAdminClient>,
  lodgifyId: number,
  start: string,
  end: string
): Promise<CalendarPeriod[]> {
  // Resolve the selected listing, then expand to every listing of the same
  // physical house. A house is often two Lodgify listings (duplicate rows) —
  // a booking on one shows as an id-less mirror block on the other, so we must
  // union both rows' reservations to reconstruct the real calendar.
  const { data: selected } = await admin
    .from("property")
    .select("id, nickname")
    .eq("lodgify_property_id", lodgifyId)
    .limit(1)
    .maybeSingle();

  if (!selected) return [];

  let groupIds = [selected.id];
  if (selected.nickname) {
    const { data: siblings } = await admin
      .from("property")
      .select("id")
      .ilike("nickname", selected.nickname);
    if (siblings?.length) groupIds = siblings.map((s) => s.id);
  }

  const periods: CalendarPeriod[] = [];

  // Reservations: everything not cancelled that has a night in the window.
  const { data: regs } = await admin
    .from("registration")
    .select("check_in_date, check_out_date, status, booking_source")
    .in("property_id", groupIds)
    .neq("status", "cancelled")
    .lte("check_in_date", end)
    .gt("check_out_date", start);

  for (const r of regs ?? []) {
    const lastNight = shiftIsoDate(r.check_out_date, -1); // checkout day itself is free
    if (lastNight < r.check_in_date) continue; // zero-night / bad data
    periods.push({
      start: r.check_in_date,
      end: lastNight,
      available: 0,
      // Only unpaid holds read as tentative; those are always our own direct/
      // admin bookings. Confirmed OTA + paid stays are booked (red, gated).
      confirmed: r.status !== "pending_payment",
      kind: "booking",
    });
  }

  // Manual owner blocks (maintenance, owner stays). Gated like a booking.
  const { data: blocks } = await admin
    .from("property_block")
    .select("start_date, end_date, reason")
    .in("property_id", groupIds)
    .lte("start_date", end)
    .gt("end_date", start);

  for (const b of blocks ?? []) {
    const lastNight = shiftIsoDate(b.end_date, -1);
    if (lastNight < b.start_date) continue;
    periods.push({
      start: b.start_date,
      end: lastNight,
      available: 0,
      confirmed: true,
      kind: "block",
      label: b.reason || "Owner block",
    });
  }

  return periods;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  // Callers pass the Lodgify property id (unchanged contract). We map it to our
  // property row(s) below.
  const lodgifyId = Number(searchParams.get("property_id"));
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!lodgifyId || !start || !end) {
    return NextResponse.json(
      { error: "property_id, start, and end are required" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Min stays come from Lodgify in parallel with the DB queries; on any
  // failure they're omitted and the UI falls back to quote-time errors.
  const [periods, minStayData] = await Promise.all([
    loadPeriods(admin, lodgifyId, start, end),
    fetchMinStays(lodgifyId, start, end),
  ]);

  return NextResponse.json(minStayData ? { periods, ...minStayData } : { periods });
}
