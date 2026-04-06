import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  let body: {
    registration_id: string;
    full_name: string;
    email: string;
    phone?: string;
    address?: {
      street1: string;
      street2: string;
      city: string;
      state: string;
      zip: string;
      country: string;
    };
    guests: Array<{ first_name: string; last_name: string; age_group: "over_21" | "under_21" | "infant" }>;
    pets: Array<{
      name: string;
      kind: string;
      rabies_doc_path: string | null;
      rabies_doc_name: string | null;
      vaccination_doc_path: string | null;
      vaccination_doc_name: string | null;
    }>;
    notes: string | null;
    vehicles: Array<{
      make: string;
      model: string;
      color: string;
      license_plate: string;
      state_or_region: string;
      year: string;
      driver_name: string;
    }>;
    tips?: {
      breakfast: number;
      delivery: number;
      cleaning: number;
    };
    signature?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { registration_id, full_name, email, phone, address, guests: guestList, pets: petList, notes, tips, vehicles, signature } = body;

  if (!registration_id || !full_name || !email) {
    return NextResponse.json(
      { error: "registration_id, full_name, and email are required" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Find the registration and its guest
  const { data: reg, error: regError } = await supabase
    .from("registration")
    .select("id, guest_id, property_id")
    .eq("id", registration_id)
    .single();

  if (regError || !reg) {
    return NextResponse.json(
      { error: "Registration not found" },
      { status: 404 }
    );
  }

  // Verify guest name matches
  const { data: guest, error: guestError } = await supabase
    .from("guest")
    .select("id, full_name")
    .eq("id", reg.guest_id)
    .single();

  if (guestError || !guest) {
    return NextResponse.json(
      { error: "Guest not found" },
      { status: 404 }
    );
  }

  // Update guest with portal info — name may differ from Lodgify (e.g. full name vs first only)
  const guestUpdate: Record<string, unknown> = {
    full_name: full_name.trim(),
    email: email.trim().toLowerCase(),
  };
  if (phone) guestUpdate.phone = phone.replace(/\D/g, "");
  if (address) {
    guestUpdate.mailing_address = [
      address.street1,
      address.street2,
      `${address.city}, ${address.state} ${address.zip}`,
      address.country !== "US" ? address.country : "",
    ].filter(Boolean).join("\n");
  }

  await supabase
    .from("guest")
    .update(guestUpdate)
    .eq("id", guest.id);

  // Upload signature if provided
  let signatureUrl: string | null = null;
  if (signature && signature.startsWith("data:image/")) {
    const match = signature.match(/^data:image\/(png|jpeg);base64,/);
    if (match) {
      const mimeType = match[1] as "png" | "jpeg";
      const ext = mimeType === "jpeg" ? "jpg" : "png";
      const base64 = signature.replace(match[0], "");
      const buffer = Buffer.from(base64, "base64");
      const path = `signatures/${reg.id}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("registrations")
        .upload(path, buffer, {
          contentType: `image/${mimeType}`,
          upsert: true,
        });

      if (!uploadError) {
        signatureUrl = path;
      }
    }
  }

  // Update registration details with guest list
  const validGuests = (guestList || []).filter((g) => g.first_name.trim() && g.last_name.trim());

  const registrationUpdate: Record<string, unknown> = {
    num_guests: validGuests.length || 1,
    notes: notes || null,
    guest_list: validGuests.map((g) => ({
      first_name: g.first_name.trim(),
      last_name: g.last_name.trim(),
      age_group: g.age_group || "over_21",
    })),
    pets: (petList || []).filter((p) => p.name.trim()).map((p) => ({
      name: p.name.trim(),
      kind: p.kind.trim(),
      rabies_doc_path: p.rabies_doc_path,
      vaccination_doc_path: p.vaccination_doc_path,
    })),
  };

  if (signatureUrl) {
    registrationUpdate.signature_url = signatureUrl;
  }

  if (tips && (tips.breakfast || tips.delivery || tips.cleaning)) {
    registrationUpdate.tips = {
      breakfast_cents: tips.breakfast || 0,
      delivery_cents: tips.delivery || 0,
      cleaning_cents: tips.cleaning || 0,
    };
  }

  await supabase
    .from("registration")
    .update(registrationUpdate)
    .eq("id", reg.id);

  // Insert vehicles
  if (vehicles && vehicles.length > 0) {
    // Remove existing vehicles for this registration first
    await supabase
      .from("vehicle")
      .delete()
      .eq("registration_id", reg.id);

    const vehicleRows = vehicles
      .filter((v) => v.license_plate.trim())
      .map((v) => ({
        registration_id: reg.id,
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
  }

  // Log initial registration
  await supabase.from("registration_update_log").insert({
    registration_id: reg.id,
    changed_by: "guest",
    change_type: "initial_registration",
    summary: `Initial registration by ${full_name}`,
  });

  // Trigger PEPOA PDF generation + email (fire and forget)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  fetch(`${appUrl}/api/pepoa/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ registration_id: reg.id }),
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
