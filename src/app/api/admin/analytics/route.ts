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

  const propertyIds = properties.map((p) => p.id);

  const { data: registrations } = await supabase
    .from("registration")
    .select(
      "id, property_id, check_in_date, check_out_date, num_guests, status, booking_source, total_amount_cents, created_at"
    )
    .in("property_id", propertyIds);

  const { data: qrCodes } = await supabase
    .from("qr_code")
    .select("scan_count")
    .in("property_id", propertyIds);

  const qrScans = (qrCodes ?? []).reduce((sum, q) => sum + q.scan_count, 0);

  return NextResponse.json({
    properties: properties.map((p) => ({
      id: p.id,
      name: p.nickname || p.name,
    })),
    registrations: (registrations ?? []).map((r) => ({
      id: r.id,
      propertyId: r.property_id,
      checkIn: r.check_in_date,
      checkOut: r.check_out_date,
      guests: r.num_guests,
      status: r.status,
      source: r.booking_source,
      amount: r.total_amount_cents ?? 0,
      createdAt: r.created_at,
    })),
    qrScans,
  });
}
