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
    .select("id, name, nickname, cleaning_fee_cents, pet_fee_cents")
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
      "id, property_id, check_in_date, check_out_date, num_guests, status, booking_source, total_amount_cents, created_at, lodgify_num_pets, pets, upsells, guest:guest_id(full_name)"
    )
    .in("property_id", propertyIds);

  const { data: qrCodes } = await supabase
    .from("qr_code")
    .select("scan_count")
    .in("property_id", propertyIds);

  const qrScans = (qrCodes ?? []).reduce((sum, q) => sum + q.scan_count, 0);

  // Build property fee lookup
  const propertyFees: Record<string, { cleaningFeeCents: number; petFeeCents: number }> = {};
  for (const p of properties) {
    propertyFees[p.id] = {
      cleaningFeeCents: p.cleaning_fee_cents ?? 0,
      petFeeCents: p.pet_fee_cents ?? 0,
    };
  }

  return NextResponse.json({
    properties: uniqueProperties,
    registrations: (registrations ?? []).map((r) => {
      const fees = propertyFees[r.property_id] ?? { cleaningFeeCents: 0, petFeeCents: 0 };
      const pets = (r.pets as unknown[] | null) ?? [];
      const numPets = pets.length || (r.lodgify_num_pets ?? 0);
      const upsells = (r.upsells as Array<{ type: string; label: string; price_cents: number; status: string }> | null) ?? [];

      return {
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
        cleaningFeeCents: fees.cleaningFeeCents,
        petFeeCents: numPets > 0 ? fees.petFeeCents * numPets : 0,
        numPets,
        upsells: upsells
          .filter((u) => u.status === "completed" || u.status === "paid")
          .map((u) => ({ type: u.type, label: u.label, priceCents: u.price_cents })),
      };
    }),
    qrScans,
  });
}
