import { NextResponse, after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyGuestToken } from "@/lib/guest-token";
import { notifyCleanersOfPetAdded } from "@/lib/sms/notify-cleaners";
import { notifyHostOfRegistration } from "@/lib/push/notify-host";
import { submitPEPOAEmail } from "@/lib/pepoa/submit-email";

type GuestEntry = { first_name: string; last_name: string; age_group: string };
type VehicleRow = {
  make: string | null; model: string | null; color: string | null;
  license_plate: string; year: string | null; state_or_region: string | null; driver_name: string | null;
};

function describeVehicle(v: { year?: string | null; color?: string | null; make?: string | null; model?: string | null; license_plate: string }) {
  const detail = [v.year, v.color, v.make, v.model].filter(Boolean).join(" ");
  return detail ? `${detail} (${v.license_plate})` : v.license_plate;
}

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
  let petCount = 0;

  if (section === "guest_list" && body.guest_list) {
    const validGuests = body.guest_list.filter((g) => g.first_name.trim() && g.last_name.trim());

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

    const prevGuests = ((reg.guest_list as GuestEntry[] | null) ?? []);

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

    const added = validGuests.filter(
      (g) => !prevGuests.some((p) => p.first_name === g.first_name.trim() && p.last_name === g.last_name.trim())
    );
    const removed = prevGuests.filter(
      (p) => !validGuests.some((g) => g.first_name.trim() === p.first_name && g.last_name.trim() === p.last_name)
    );

    const parts: string[] = [`Guest list changed from ${prevGuests.length} to ${validGuests.length} guest(s)`];
    if (added.length) parts.push(`Added: ${added.map((g) => `${g.first_name.trim()} ${g.last_name.trim()}`).join(", ")}`);
    if (removed.length) parts.push(`Removed: ${removed.map((g) => `${g.first_name} ${g.last_name}`).join(", ")}`);
    summary = parts.join(". ");

    await supabase.from("registration_update_log").insert({
      registration_id,
      changed_by: "guest",
      change_type: "guest_list_update",
      summary,
      previous_data: { guest_list: prevGuests } as Record<string, unknown>,
      new_data: { guest_list: validGuests } as Record<string, unknown>,
    });
  } else if (section === "pets" && body.pets) {
    const validPets = body.pets.filter((p) => p.name.trim());
    const prevPets = reg.pets as Array<{ name: string; kind: string }> | null ?? [];
    petCount = validPets.length;

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

    const added = validPets.filter((p) => !prevPets.some((prev) => prev.name === p.name.trim()));
    const removed = prevPets.filter((prev) => !validPets.some((p) => p.name.trim() === prev.name));

    const parts: string[] = [`Pet list changed from ${prevPets.length} to ${validPets.length} pet(s)`];
    if (added.length) parts.push(`Added: ${added.map((p) => `${p.name.trim()} (${p.kind.trim()})`).join(", ")}`);
    if (removed.length) parts.push(`Removed: ${removed.map((p) => `${p.name} (${p.kind})`).join(", ")}`);
    summary = parts.join(". ");

    await supabase.from("registration_update_log").insert({
      registration_id,
      changed_by: "guest",
      change_type: "pets_update",
      summary,
      previous_data: { pets: prevPets } as Record<string, unknown>,
      new_data: { pets: validPets } as Record<string, unknown>,
    });
  } else if (section === "vehicles" && body.vehicles) {
    const { data: property } = await supabase
      .from("property")
      .select("max_vehicles")
      .eq("id", reg.property_id)
      .single();

    const maxVehicles = property?.max_vehicles ?? 6;
    const validVehicles = body.vehicles.filter((v) => v.license_plate.trim());
    if (validVehicles.length > maxVehicles) {
      return NextResponse.json(
        { error: `Vehicle list exceeds property limit of ${maxVehicles}` },
        { status: 400 }
      );
    }

    const { data: currentVehicles } = await supabase
      .from("vehicle")
      .select("*")
      .eq("registration_id", registration_id);

    const prevVehicles = (currentVehicles ?? []) as VehicleRow[];

    await supabase.from("vehicle").delete().eq("registration_id", registration_id);

    const vehicleRows = validVehicles.map((v) => ({
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

    const added = vehicleRows.filter((v) => !prevVehicles.some((p) => p.license_plate === v.license_plate));
    const removed = prevVehicles.filter((p) => !vehicleRows.some((v) => v.license_plate === p.license_plate));

    const parts: string[] = [`Vehicle list changed from ${prevVehicles.length} to ${vehicleRows.length} vehicle(s)`];
    if (added.length) parts.push(`Added: ${added.map(describeVehicle).join(", ")}`);
    if (removed.length) parts.push(`Removed: ${removed.map(describeVehicle).join(", ")}`);
    summary = parts.join(". ");

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

  const capturedSummary = summary;
  const capturedPetCount = petCount;
  const capturedPropertyId = reg.property_id as string;
  const capturedCheckIn = reg.check_in_date as string | null;
  const capturedGuestName = guest?.full_name ?? "Guest";

  after(async () => {
    await submitPEPOAEmail({ registrationId: registration_id, isUpdate: true, changeSummary: capturedSummary }).catch((err) => {
      console.error("Failed to send PEPOA update email:", err);
    });

    await notifyHostOfRegistration({
      propertyId: capturedPropertyId,
      registrationId: registration_id,
      guestName: capturedGuestName,
      summary: capturedSummary,
      isUpdate: true,
    }).catch(() => {});

    if (capturedPetCount > 0 && capturedCheckIn) {
      await notifyCleanersOfPetAdded({
        propertyId: capturedPropertyId,
        registrationId: registration_id,
        guestName: capturedGuestName,
        checkIn: capturedCheckIn,
        numPets: capturedPetCount,
      }).catch(() => {});
    }
  });

  return NextResponse.json({ ok: true, summary });
}
