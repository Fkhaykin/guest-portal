import { createBooking } from "./client";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Push a confirmed local registration to Lodgify as a "Booked" reservation, so it
 * blocks the Lodgify calendar and distributes to connected channels (Airbnb, VRBO…).
 *
 * Idempotent: a registration that already carries a lodgify_booking_id is skipped.
 * Records the outcome in lodgify_sync_status ("synced" | "failed") and never throws —
 * callers can fire-and-forget or await without guarding. A push for dates Lodgify
 * considers unavailable (e.g. a deliberate double booking) fails here and is recorded
 * as "failed"; the local registration is left intact.
 */
export async function pushBookingToLodgify(
  registrationId: string,
  supabase: SupabaseClient
): Promise<void> {
  const { data: reg } = await supabase
    .from("registration")
    .select("*, guest:guest_id(full_name, email, phone), property:property_id(lodgify_property_id)")
    .eq("id", registrationId)
    .single();

  if (!reg) return;
  if (reg.lodgify_booking_id) return; // already on Lodgify

  const guest = reg.guest as unknown as { full_name: string; email: string | null; phone: string | null } | null;
  const prop = reg.property as unknown as { lodgify_property_id: number | null } | null;

  if (!prop?.lodgify_property_id || !guest) {
    await supabase.from("registration").update({ lodgify_sync_status: "failed" }).eq("id", registrationId);
    return;
  }

  try {
    const bookingId = await createBooking({
      propertyId: prop.lodgify_property_id,
      arrival: reg.check_in_date,
      departure: reg.check_out_date,
      guestName: guest.full_name,
      guestEmail: guest.email || "",
      guestPhone: guest.phone || "",
      guests: reg.num_guests || 1,
      totalAmount: (reg.total_amount_cents || 0) / 100,
      source: "Direct",
    });
    await supabase
      .from("registration")
      .update({ lodgify_booking_id: bookingId, lodgify_sync_status: "synced" })
      .eq("id", registrationId);
  } catch (err) {
    console.error(`[lodgify-push] Failed to create booking for registration ${registrationId}:`, err);
    await supabase.from("registration").update({ lodgify_sync_status: "failed" }).eq("id", registrationId);
  }
}
