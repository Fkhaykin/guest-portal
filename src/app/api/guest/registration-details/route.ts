import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  let body: { registration_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { registration_id } = body;
  if (!registration_id) {
    return NextResponse.json({ error: "registration_id is required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: reg, error: regError } = await supabase
    .from("registration")
    .select("id, guest_list, pets, property_id")
    .eq("id", registration_id)
    .single();

  if (regError || !reg) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 });
  }

  const { data: property } = await supabase
    .from("property")
    .select("max_guests")
    .eq("id", reg.property_id)
    .single();

  const { data: vehicles } = await supabase
    .from("vehicle")
    .select("make, model, color, license_plate, state_or_region, year, driver_name")
    .eq("registration_id", registration_id);

  // Check if booking originally included pets (via Lodgify guest breakdown)
  const pets = (reg.pets as Array<Record<string, unknown>>) || [];
  const hasPetsFromBooking = pets.length > 0;

  return NextResponse.json({
    id: reg.id,
    property_id: reg.property_id,
    guest_list: reg.guest_list || [],
    pets: reg.pets || [],
    has_pets_from_booking: hasPetsFromBooking,
    max_guests: property?.max_guests ?? 16,
    vehicles: (vehicles || []).map((v) => ({
      make: v.make || "",
      model: v.model || "",
      color: v.color || "",
      license_plate: v.license_plate || "",
      state_or_region: v.state_or_region || "",
      year: v.year || "",
      driver_name: v.driver_name || "",
    })),
  });
}
