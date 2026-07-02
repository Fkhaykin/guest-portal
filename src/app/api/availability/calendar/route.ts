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

// Availability is now sourced entirely from our own database — the bookings
// Lodgify channel-syncs into `registration` (Airbnb/VRBO/etc.), our direct
// bookings, and manual owner blocks. No live Lodgify calls, so this never
// stalls on Lodgify's rate limit.
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

  if (!selected) return NextResponse.json({ periods: [] });

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

  return NextResponse.json({ periods });
}
