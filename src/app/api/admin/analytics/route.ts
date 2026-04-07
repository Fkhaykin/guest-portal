import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();

  const hostResult = await supabase.from("host").select().single();
  if (!hostResult.data) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hostId = hostResult.data.id;

  const { data: properties } = await supabase
    .from("property")
    .select("id, name, nickname")
    .eq("host_id", hostId);

  if (!properties || properties.length === 0) {
    return NextResponse.json({ properties: [], registrations: [], qrScans: 0 });
  }

  // Build display names — merge properties with same nickname (case-insensitive)
  // e.g. "chalet" and "Chalet" are the same house on different listings
  const displayNames: Record<string, string> = {};
  for (const p of properties) {
    displayNames[p.id] = p.nickname || p.name;
  }

  // Deduplicate: properties that share a nickname (case-insensitive) are the same house
  const seen = new Map<string, string>(); // lowercase name → canonical name
  for (const p of properties) {
    const name = displayNames[p.id];
    const key = name.toLowerCase();
    if (seen.has(key)) {
      displayNames[p.id] = seen.get(key)!;
    } else {
      seen.set(key, name);
    }
  }

  // Build deduplicated property list for the client (one entry per unique display name)
  const uniqueProperties: { id: string; name: string }[] = [];
  const seenNames = new Set<string>();
  for (const p of properties) {
    const name = displayNames[p.id];
    if (!seenNames.has(name)) {
      seenNames.add(name);
      uniqueProperties.push({ id: p.id, name });
    }
  }

  const propertyIds = properties.map((p) => p.id);

  const { data: registrations } = await supabase
    .from("registration")
    .select(
      "id, property_id, check_in_date, check_out_date, num_guests, status, booking_source, total_amount_cents, created_at, guest:guest_id(full_name)"
    )
    .in("property_id", propertyIds);

  const { data: qrCodes } = await supabase
    .from("qr_code")
    .select("scan_count")
    .in("property_id", propertyIds);

  const qrScans = (qrCodes ?? []).reduce((sum, q) => sum + q.scan_count, 0);

  return NextResponse.json({
    properties: uniqueProperties,
    registrations: (registrations ?? []).map((r) => ({
      id: r.id,
      propertyId: r.property_id,
      propertyName: displayNames[r.property_id],
      checkIn: r.check_in_date,
      checkOut: r.check_out_date,
      guests: r.num_guests,
      status: r.status,
      source: r.booking_source,
      amount: r.total_amount_cents ?? 0,
      createdAt: r.created_at,
      guestName: (r.guest as unknown as { full_name: string } | null)?.full_name ?? "Unknown",
    })),
    qrScans,
  });
}
