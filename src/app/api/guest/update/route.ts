import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyGuestToken } from "@/lib/guest-token";

export async function POST(request: Request) {
  let body: {
    registration_id: string;
    section: "guest_list" | "pets" | "vehicles";
    guest_list?: Array<{ first_name: string; last_name: string; age_group: "over_21" | "under_21" | "infant" }>;
    pets?: Array<{
      name: string;
      kind: string;
      rabies_doc_path: string | null;
      vaccination_doc_path: string | null;
    }>;
    vehicles?: Array<{
      make: string;
      model: string;
      color: string;
      license_plate: string;
      state_or_region: string;
      year: string;
      driver_name: string;
    }>;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { registration_id, section } = body;
  if (!registration_id || !section) {
    return NextResponse.json({ error: "registration_id and section are required" }, { status: 400 });
  }

  const token = request.headers.get("x-guest-token") || "";
  if (!verifyGuestToken(registration_id, token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Fetch current registration data for snapshot
  const { data: reg, error: regError } = await supabase
    .from("registration")
    .select("*, guest:guest_id(full_name)")
    .eq("id", registration_id)
    .single();

  if (regError || !reg) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 });
  }

  const guest = reg.guest as { full_name: string } | null;
  let summary = "";

  if (section === "guest_list" && body.guest_list) {
    const validGuests = body.guest_list.filter((g) => g.first_name.trim() && g.last_name.trim());

    // Enforce property capacity
    const { data: property } = await supabase
      .from("property")
      .select("max_guests")
      .eq("id", reg.property_id)
      .single();

    const maxGuests = property?.max_guests ?? 12;
    if (validGuests.length > maxGuests) {
      return NextResponse.json(
        { error: `Guest list exceeds property capacity of ${maxGuests}` },
        { status: 400 }
      );
    }

    const previous = reg.guest_list;

    await supabase
      .from("registration")
      .update({
        guest_list: validGuests.map((g) => ({
          first_name: g.first_name.trim(),
          last_name: g.last_name.trim(),
          age_group: g.age_group || "over_21",
        })),
        num_guests: validGuests.length || 1,
      })
      .eq("id", registration_id);

    summary = `Guest list updated to ${validGuests.length} guest(s)`;

    await supabase.from("registration_update_log").insert({
      registration_id,
      changed_by: "guest",
      change_type: "guest_list_update",
      summary,
      previous_data: { guest_list: previous } as Record<string, unknown>,
      new_data: { guest_list: validGuests } as Record<string, unknown>,
    });
  } else if (section === "pets" && body.pets) {
    const validPets = body.pets.filter((p) => p.name.trim());
    const previous = reg.pets;

    await supabase
      .from("registration")
      .update({
        pets: validPets.map((p) => ({
          name: p.name.trim(),
          kind: p.kind.trim(),
          rabies_doc_path: p.rabies_doc_path,
          vaccination_doc_path: p.vaccination_doc_path,
        })),
      })
      .eq("id", registration_id);

    summary = `Pets updated to ${validPets.length} pet(s)`;

    await supabase.from("registration_update_log").insert({
      registration_id,
      changed_by: "guest",
      change_type: "pets_update",
      summary,
      previous_data: { pets: previous } as Record<string, unknown>,
      new_data: { pets: validPets } as Record<string, unknown>,
    });
  } else if (section === "vehicles" && body.vehicles) {
    // Fetch current vehicles for snapshot
    const { data: currentVehicles } = await supabase
      .from("vehicle")
      .select("*")
      .eq("registration_id", registration_id);

    // Delete and re-insert
    await supabase.from("vehicle").delete().eq("registration_id", registration_id);

    const vehicleRows = body.vehicles
      .filter((v) => v.license_plate.trim())
      .map((v) => ({
        registration_id,
        make: v.make?.trim() || null,
        model: v.model?.trim() || null,
        color: v.color?.trim() || null,
        license_plate: v.license_plate.trim(),
        state_or_region: v.state_or_region?.trim() || null,
        year: v.year?.trim() || null,
        driver_name: v.driver_name?.trim() || null,
      }));

    if (vehicleRows.length > 0) {
      await supabase.from("vehicle").insert(vehicleRows);
    }

    summary = `Vehicles updated to ${vehicleRows.length} vehicle(s)`;

    await supabase.from("registration_update_log").insert({
      registration_id,
      changed_by: "guest",
      change_type: "vehicles_update",
      summary,
      previous_data: { vehicles: currentVehicles } as Record<string, unknown>,
      new_data: { vehicles: vehicleRows } as Record<string, unknown>,
    });
  } else {
    return NextResponse.json({ error: "Invalid section or missing data" }, { status: 400 });
  }

  // Re-generate and email PEPOA PDF
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  fetch(`${appUrl}/api/pepoa/submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ registration_id, is_update: true, change_summary: summary }),
  }).catch(() => {});

  return NextResponse.json({ ok: true, summary });
}
