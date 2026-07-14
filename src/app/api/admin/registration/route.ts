import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cancelBooking } from "@/lib/lodgify/client";
import { pushBookingToLodgify } from "@/lib/lodgify/push";

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
    review_request_forced?: boolean;
    early_checkin_override?: "allow" | "block" | null;
    early_checkin_override_hours?: number | null;
    late_checkout_override?: "allow" | "block" | null;
    late_checkout_override_hours?: number | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const update: {
    hoa_email_disabled?: boolean;
    review_request_disabled?: boolean;
    review_request_forced?: boolean;
    review_request_skipped_at?: string | null;
    review_request_skip_reason?: string | null;
    early_checkin_override?: "allow" | "block" | null;
    early_checkin_override_hours?: number | null;
    late_checkout_override?: "allow" | "block" | null;
    late_checkout_override_hours?: number | null;
  } = {};
  const summaries: string[] = [];
  if (typeof body.hoa_email_disabled === "boolean") {
    update.hoa_email_disabled = body.hoa_email_disabled;
    summaries.push(
      body.hoa_email_disabled
        ? "Automatic HOA registration submission turned off for this reservation"
        : "Automatic HOA registration submission turned on for this reservation"
    );
  }
  // The review-request toggle sends both flags: on = force-on, off = force-off.
  // Both are sticky manual overrides; forcing on also clears any auto-skip flag
  // so the card reflects the send and the cron won't re-skip.
  if (typeof body.review_request_disabled === "boolean" || typeof body.review_request_forced === "boolean") {
    if (typeof body.review_request_disabled === "boolean") update.review_request_disabled = body.review_request_disabled;
    if (typeof body.review_request_forced === "boolean") update.review_request_forced = body.review_request_forced;
    if (body.review_request_forced === true) {
      update.review_request_skipped_at = null;
      update.review_request_skip_reason = null;
    }
    summaries.push(
      body.review_request_forced === true
        ? "Post-checkout review request manually turned on for this reservation (overriding automatic skip)"
        : body.review_request_disabled === true
        ? "Post-checkout review request turned off for this reservation"
        : "Post-checkout review request set to automatic for this reservation"
    );
  }
  // Timing-upsell overrides: 'allow' forces the add-on purchasable regardless
  // of turnaround rules (optionally with a custom max hours), 'block' hides it
  // entirely, null returns it to automatic. Hours only ride along with 'allow'.
  for (const side of ["early_checkin", "late_checkout"] as const) {
    const overrideKey = `${side}_override` as const;
    const hoursKey = `${side}_override_hours` as const;
    if (!(overrideKey in body)) continue;

    const override = body[overrideKey];
    if (override !== "allow" && override !== "block" && override !== null) {
      return NextResponse.json({ error: `Invalid ${overrideKey}` }, { status: 400 });
    }
    const rawHours = body[hoursKey];
    const hours =
      override === "allow" && typeof rawHours === "number" ? Math.trunc(rawHours) : null;
    if (hours !== null && (hours < 1 || hours > 12)) {
      return NextResponse.json({ error: `Invalid ${hoursKey} (1-12)` }, { status: 400 });
    }
    update[overrideKey] = override;
    update[hoursKey] = hours;

    const label = side === "early_checkin" ? "Early check-in" : "Late check-out";
    summaries.push(
      override === "allow"
        ? `${label} manually set to always available for this reservation (up to ${hours ?? 2} extra hour${(hours ?? 2) === 1 ? "" : "s"}, overriding turnaround rules)`
        : override === "block"
        ? `${label} manually blocked for this reservation (overriding turnaround rules)`
        : `${label} availability set back to automatic for this reservation`
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
    // Optional manual revenue override (cents); omitted = leave unchanged.
    total_amount_cents?: number | null;
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

  const newNumGuests = body.num_guests || validGuests.length || 1;
  const newNotes = body.notes.trim() || null;
  const newTotalCents =
    typeof body.total_amount_cents === "number" &&
    Number.isFinite(body.total_amount_cents) &&
    body.total_amount_cents >= 0
      ? Math.round(body.total_amount_cents)
      : null;

  // Sync-owned fields the admin is changing. On a Lodgify-linked booking these
  // must be locked against the sync upsert, or the next webhook/full sync
  // silently reverts the manual edit (see syncBooking's sync_locked_fields).
  const changedSynced: string[] = [];
  if (body.check_in_date !== reg.check_in_date) changedSynced.push("check_in_date");
  if (body.check_out_date !== reg.check_out_date) changedSynced.push("check_out_date");
  if (newNumGuests !== reg.num_guests) changedSynced.push("num_guests");
  if (body.status !== reg.status) changedSynced.push("status");
  if (newNotes !== (reg.notes ?? null)) changedSynced.push("notes");
  if (newTotalCents !== null && newTotalCents !== reg.total_amount_cents) changedSynced.push("total_amount_cents");

  const mergedLocks = [
    ...new Set([...(((reg.sync_locked_fields as string[] | null) ?? [])), ...changedSynced]),
  ];

  await admin
    .from("registration")
    .update({
      check_in_date: body.check_in_date,
      check_out_date: body.check_out_date,
      num_guests: newNumGuests,
      status: body.status,
      notes: newNotes,
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
      ...(newTotalCents !== null ? { total_amount_cents: newTotalCents } : {}),
      ...(reg.lodgify_booking_id && changedSynced.length > 0
        ? { sync_locked_fields: mergedLocks }
        : {}),
    })
    .eq("id", body.registration_id);

  // Locally-pushed bookings (admin "New booking" / direct checkout) hold their
  // dates on Lodgify via a synthetic reservation. Lodgify has no update API, so
  // a date change moves the hold: delete the old booking, push a fresh one for
  // the new dates. OTA bookings are never touched — their calendar lives on the
  // channel; the sync-lock above keeps the local edit from being reverted.
  let lodgifyWarning: string | null = null;
  const datesChanged =
    changedSynced.includes("check_in_date") || changedSynced.includes("check_out_date");
  const isLocalPush = reg.booking_source === "admin" || reg.booking_source === "direct";
  if (datesChanged && reg.lodgify_booking_id && isLocalPush) {
    const oldLodgifyId = reg.lodgify_booking_id as number;
    const released = await cancelBooking(oldLodgifyId);
    if (!released) {
      lodgifyWarning = `The old Lodgify hold (booking #${oldLodgifyId}) could not be deleted — remove it in Lodgify so the old dates reopen on Airbnb/VRBO.`;
    }
    await admin
      .from("registration")
      .update({ lodgify_booking_id: null, lodgify_sync_status: null })
      .eq("id", body.registration_id);
    await pushBookingToLodgify(body.registration_id, admin);

    const { data: after } = await admin
      .from("registration")
      .select("lodgify_booking_id, lodgify_sync_status")
      .eq("id", body.registration_id)
      .single();
    if (after?.lodgify_booking_id && after.lodgify_sync_status === "synced") {
      // Keep message-thread links pointing at the live Lodgify booking.
      await admin
        .from("guest_message")
        .update({ lodgify_booking_id: after.lodgify_booking_id })
        .eq("lodgify_booking_id", oldLodgifyId);
      await admin
        .from("guest_message_thread")
        .update({ lodgify_booking_id: after.lodgify_booking_id })
        .eq("lodgify_booking_id", oldLodgifyId);
    } else {
      lodgifyWarning = [
        lodgifyWarning,
        "The new dates could not be held on Lodgify — Airbnb/VRBO can book them. Check the Lodgify connection.",
      ]
        .filter(Boolean)
        .join(" ");
    }
  }

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
      total_amount_cents: reg.total_amount_cents,
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
      total_amount_cents: newTotalCents ?? reg.total_amount_cents,
    } as Record<string, unknown>,
  });

  return NextResponse.json({ ok: true, lodgify_warning: lodgifyWarning });
}
