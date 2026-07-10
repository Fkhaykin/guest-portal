import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET — fetch full registration data for editing
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  // Verify caller is authenticated admin
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: reg, error } = await admin
    .from("registration")
    .select("*, guest:guest_id(id, full_name, email, phone, mailing_address)")
    .eq("id", id)
    .single();

  if (error || !reg) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 });
  }

  // Fetch vehicles separately
  const { data: vehicles } = await admin
    .from("vehicle")
    .select("*")
    .eq("registration_id", id);

  return NextResponse.json({ registration: reg, vehicles: vehicles ?? [] });
}

// PATCH — flip a per-reservation admin toggle (HOA auto-email, review request)
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    registration_id: string;
    hoa_email_disabled?: boolean;
    review_request_disabled?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const update: { hoa_email_disabled?: boolean; review_request_disabled?: boolean } = {};
  const summaries: string[] = [];
  if (typeof body.hoa_email_disabled === "boolean") {
    update.hoa_email_disabled = body.hoa_email_disabled;
    summaries.push(
      body.hoa_email_disabled
        ? "Automatic HOA registration submission turned off for this reservation"
        : "Automatic HOA registration submission turned on for this reservation"
    );
  }
  if (typeof body.review_request_disabled === "boolean") {
    update.review_request_disabled = body.review_request_disabled;
    summaries.push(
      body.review_request_disabled
        ? "Post-checkout review request turned off for this reservation"
        : "Post-checkout review request turned on for this reservation"
    );
  }

  if (!body.registration_id || summaries.length === 0) {
    return NextResponse.json(
      { error: "registration_id and at least one toggle field are required" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("registration")
    .update(update)
    .eq("id", body.registration_id);

  if (error) {
    return NextResponse.json({ error: "Failed to update registration" }, { status: 500 });
  }

  await admin.from("registration_update_log").insert(
    summaries.map((summary) => ({
      registration_id: body.registration_id,
      changed_by: "admin",
      change_type: "admin_edit",
      summary,
    }))
  );

  return NextResponse.json({ ok: true });
}

// PUT — update registration (admin)
export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    registration_id: string;
    guest_name: string;
    guest_email: string;
    guest_phone: string;
    guest_mailing_address: string;
    check_in_date: string;
    check_out_date: string;
    num_guests: number;
    status: "active" | "completed" | "cancelled";
    notes: string;
    guest_list: Array<{ first_name: string; last_name: string; age_group: string }>;
    pets: Array<{ name: string; kind: string; rabies_doc_path: string | null; vaccination_doc_path: string | null }>;
    vehicles: Array<{
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

  if (!body.registration_id) {
    return NextResponse.json({ error: "registration_id is required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Fetch current registration for audit log
  const { data: reg, error: regError } = await admin
    .from("registration")
    .select("*, guest:guest_id(id, full_name, email, phone, mailing_address)")
    .eq("id", body.registration_id)
    .single();

  if (regError || !reg) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 });
  }

  const guest = reg.guest as { id: string; full_name: string; email: string | null; phone: string | null; mailing_address: string | null } | null;

  // Update guest record
  if (guest) {
    await admin
      .from("guest")
      .update({
        full_name: body.guest_name.trim(),
        email: body.guest_email.trim().toLowerCase() || null,
        phone: body.guest_phone.trim() || null,
        mailing_address: body.guest_mailing_address.trim() || null,
      })
      .eq("id", guest.id);
  }

  // Build registration update
  const validGuests = (body.guest_list || []).filter(
    (g) => g.first_name.trim() && g.last_name.trim()
  );
  const validPets = (body.pets || []).filter((p) => p.name.trim());

  await admin
    .from("registration")
    .update({
      check_in_date: body.check_in_date,
      check_out_date: body.check_out_date,
      num_guests: body.num_guests || validGuests.length || 1,
      status: body.status,
      notes: body.notes.trim() || null,
      guest_list: validGuests.map((g) => ({
        first_name: g.first_name.trim(),
        last_name: g.last_name.trim(),
        age_group: g.age_group || "over_21",
      })),
      pets: validPets.map((p) => ({
        name: p.name.trim(),
        kind: p.kind.trim(),
        rabies_doc_path: p.rabies_doc_path,
        vaccination_doc_path: p.vaccination_doc_path,
      })),
    })
    .eq("id", body.registration_id);

  // Update vehicles — delete and re-insert
  await admin.from("vehicle").delete().eq("registration_id", body.registration_id);
  const vehicleRows = (body.vehicles || [])
    .filter((v) => v.license_plate.trim())
    .map((v) => ({
      registration_id: body.registration_id,
      make: v.make?.trim() || null,
      model: v.model?.trim() || null,
      color: v.color?.trim() || null,
      license_plate: v.license_plate.trim(),
      state_or_region: v.state_or_region?.trim() || null,
      year: v.year?.trim() || null,
      driver_name: v.driver_name?.trim() || null,
    }));
  if (vehicleRows.length > 0) {
    await admin.from("vehicle").insert(vehicleRows);
  }

  // Audit log
  await admin.from("registration_update_log").insert({
    registration_id: body.registration_id,
    changed_by: "admin",
    change_type: "admin_edit",
    summary: `Registration updated by admin`,
    previous_data: {
      guest_name: guest?.full_name,
      guest_email: guest?.email,
      check_in_date: reg.check_in_date,
      check_out_date: reg.check_out_date,
      status: reg.status,
      guest_list: reg.guest_list,
      pets: reg.pets,
      notes: reg.notes,
    } as Record<string, unknown>,
    new_data: {
      guest_name: body.guest_name,
      guest_email: body.guest_email,
      check_in_date: body.check_in_date,
      check_out_date: body.check_out_date,
      status: body.status,
      guest_list: validGuests,
      pets: validPets,
      vehicles: vehicleRows,
      notes: body.notes,
    } as Record<string, unknown>,
  });

  return NextResponse.json({ ok: true });
}
