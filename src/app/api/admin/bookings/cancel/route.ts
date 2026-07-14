import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cancelBooking } from "@/lib/lodgify/client";
import { notifyCleanersOfCancellation } from "@/lib/sms/notify-cleaners";

/**
 * POST /api/admin/bookings/cancel — cancel a booking from the admin panel.
 *
 * Locally-created bookings (admin / direct) are also deleted on Lodgify so the
 * dates reopen on connected channels. OTA bookings (Airbnb/VRBO) can only be
 * cancelled at the OTA — those are marked cancelled here and the status is
 * sync-locked so the next Lodgify webhook doesn't flip them back to active.
 * Stripe refunds are not automated; the admin handles those in Stripe.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { registration_id: string; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.registration_id) {
    return NextResponse.json({ error: "registration_id is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: reg } = await admin
    .from("registration")
    .select(
      "id, status, property_id, check_in_date, check_out_date, num_guests, lodgify_infants, lodgify_num_pets, notes, booking_source, lodgify_booking_id, sync_locked_fields, guest:guest_id(full_name)"
    )
    .eq("id", body.registration_id)
    .maybeSingle();

  if (!reg) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (reg.status === "cancelled") {
    return NextResponse.json({ error: "Booking is already cancelled" }, { status: 400 });
  }

  const isLocalPush = reg.booking_source === "admin" || reg.booking_source === "direct";
  const isOta = !!reg.lodgify_booking_id && !isLocalPush;

  // Release the Lodgify calendar for bookings we created there ourselves.
  let lodgifyReleased: boolean | null = null;
  if (reg.lodgify_booking_id && isLocalPush) {
    lodgifyReleased = await cancelBooking(reg.lodgify_booking_id);
  }

  // Lock status against sync overwrite for anything still linked to a live
  // Lodgify booking (OTA bookings, and local pushes whose deletion failed).
  const lockedFields = new Set((reg.sync_locked_fields as string[] | null) ?? []);
  if (reg.lodgify_booking_id) lockedFields.add("status");

  const { error: updateError } = await admin
    .from("registration")
    .update({ status: "cancelled", sync_locked_fields: [...lockedFields] })
    .eq("id", reg.id);
  if (updateError) {
    return NextResponse.json({ error: "Failed to cancel booking" }, { status: 500 });
  }

  const reason = body.reason?.trim();
  await admin.from("registration_update_log").insert({
    registration_id: reg.id,
    changed_by: "admin",
    change_type: "admin_edit",
    summary: `Booking cancelled by admin${reason ? ` — ${reason}` : ""}`,
    previous_data: { status: reg.status },
    new_data: { status: "cancelled" },
  });

  // Cleaners only care if they had been told about the stay in the first place.
  if (reg.status === "active") {
    const guest = reg.guest as unknown as { full_name: string } | null;
    await notifyCleanersOfCancellation({
      propertyId: reg.property_id,
      registrationId: reg.id,
      guestName: guest?.full_name ?? "Guest",
      checkIn: reg.check_in_date,
      checkOut: reg.check_out_date,
      numGuests: reg.num_guests || 1,
      numInfants: reg.lodgify_infants || 0,
      numPets: reg.lodgify_num_pets || 0,
      notes: reg.notes,
    }).catch((err) =>
      console.error(`[admin/bookings/cancel] Cleaner notification failed for ${reg.id}:`, err)
    );
  }

  return NextResponse.json({
    ok: true,
    lodgify_released: lodgifyReleased,
    lodgify_booking_id: reg.lodgify_booking_id,
    ota_source: isOta,
  });
}
