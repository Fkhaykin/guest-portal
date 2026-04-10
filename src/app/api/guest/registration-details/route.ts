import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyGuestToken } from "@/lib/guest-token";

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

  const token = request.headers.get("x-guest-token") || "";
  if (!verifyGuestToken(registration_id, token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: reg, error: regError } = await supabase
    .from("registration")
    .select("id, guest_list, pets, property_id, lodgify_num_pets")
    .eq("id", registration_id)
    .single();

  if (regError || !reg) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 });
  }

  const { data: property } = await supabase
    .from("property")
    .select("max_guests, pet_fee_cents")
    .eq("id", reg.property_id)
    .single();

  const { data: vehicles } = await supabase
    .from("vehicle")
    .select("make, model, color, license_plate, state_or_region, year, driver_name")
    .eq("registration_id", registration_id);

  // Check if original Lodgify booking included pets
  const lodgifyNumPets = reg.lodgify_num_pets || 0;
  const currentPets = (reg.pets as Array<Record<string, unknown>>) || [];

  return NextResponse.json({
    id: reg.id,
    property_id: reg.property_id,
    guest_list: reg.guest_list || [],
    pets: reg.pets || [],
    lodgify_num_pets: lodgifyNumPets,
    pet_fee_cents: property?.pet_fee_cents ?? 0,
    has_pets_from_booking: lodgifyNumPets > 0 || currentPets.length > 0,
    max_guests: property?.max_guests ?? 12,
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
