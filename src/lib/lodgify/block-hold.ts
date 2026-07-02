import { createBooking, cancelBooking } from "./client";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Push an owner block to Lodgify as a held "Booked" reservation so the blocked
 * nights also stop OTA channels (Airbnb/VRBO) from booking them. Lodgify has no
 * date-block API, so — exactly like a direct booking — we create a synthetic
 * reservation to hold the calendar.
 *
 * Resolves the block's property to its ACTIVE listing (the one with a Lodgify
 * mapping) so the hold lands on the real channel-connected calendar. Never
 * throws: records lodgify_booking_id + lodgify_sync_status ("synced" | "failed")
 * on the block row so a failure is visible without breaking block creation.
 */
export async function pushBlockHold(
  blockId: string,
  supabase: SupabaseClient
): Promise<void> {
  const { data: block } = await supabase
    .from("property_block")
    .select("id, start_date, end_date, reason, lodgify_booking_id, property:property_id(nickname, lodgify_property_id, is_active)")
    .eq("id", blockId)
    .single();

  if (!block) return;
  if (block.lodgify_booking_id) return; // already held

  const prop = block.property as unknown as {
    nickname: string | null;
    lodgify_property_id: number | null;
    is_active: boolean;
  } | null;

  // Resolve the Lodgify id: use the block's own property if it maps, otherwise
  // its active sibling by nickname (duplicate listings — one row is inactive).
  let lodgifyPropertyId = prop?.lodgify_property_id ?? null;
  if (!lodgifyPropertyId && prop?.nickname) {
    const { data: sibling } = await supabase
      .from("property")
      .select("lodgify_property_id")
      .ilike("nickname", prop.nickname)
      .eq("is_active", true)
      .not("lodgify_property_id", "is", null)
      .limit(1)
      .maybeSingle();
    lodgifyPropertyId = sibling?.lodgify_property_id ?? null;
  }

  if (!lodgifyPropertyId) {
    await supabase.from("property_block").update({ lodgify_sync_status: "failed" }).eq("id", blockId);
    return;
  }

  try {
    const bookingId = await createBooking({
      propertyId: lodgifyPropertyId,
      arrival: block.start_date,
      departure: block.end_date,
      guestName: block.reason ? `Owner block — ${block.reason}` : "Owner block",
      guestEmail: "",
      guestPhone: "",
      guests: 1,
      totalAmount: 0,
      source: "Direct",
    });
    await supabase
      .from("property_block")
      .update({ lodgify_booking_id: bookingId, lodgify_sync_status: "synced" })
      .eq("id", blockId);
  } catch (err) {
    console.error(`[block-hold] Failed to push block ${blockId} to Lodgify:`, err);
    await supabase.from("property_block").update({ lodgify_sync_status: "failed" }).eq("id", blockId);
  }
}

/**
 * Release the Lodgify hold for a deleted block. Returns true if Lodgify had no
 * hold to release or accepted the deletion; false if a hold existed but Lodgify
 * refused to delete it (so the caller can warn that the OTA block remains).
 */
export async function releaseBlockHold(lodgifyBookingId: number | null): Promise<boolean> {
  if (!lodgifyBookingId) return true;
  return cancelBooking(lodgifyBookingId);
}
