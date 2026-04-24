import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getBookings, getBookingById, getProperties, type LodgifyBooking } from "./client";
import { notifyCleanersOfNewBooking, notifyCleanersOfCancellation } from "@/lib/sms/notify-cleaners";

const STATUS_MAP: Record<string, "active" | "completed" | "cancelled"> = {
  Booked: "active",
  CheckedOut: "completed",
  Cancelled: "cancelled",
  Declined: "cancelled",
};

// Unconfirmed statuses that should not be synced
const SKIP_STATUSES = new Set(["Tentative", "Open"]);

function mapStatus(lodgifyStatus: string): "active" | "completed" | "cancelled" {
  return STATUS_MAP[lodgifyStatus] ?? "active";
}

/**
 * Download an image from a URL and upload it to the property-images bucket.
 * Returns the public URL on success, null on failure.
 */
async function rehostImage(
  supabase: SupabaseClient,
  imageUrl: string,
  lodgifyPropertyId: number
): Promise<string | null> {
  try {
    let url = imageUrl.startsWith("//") ? `https:${imageUrl}` : imageUrl;
    // Request a resized image to stay within the 5 MiB bucket limit
    url = url.replace(/\?.*$/, "?w=800");
    const res = await fetch(url);
    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") || "image/jpeg";
    const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    const buffer = Buffer.from(await res.arrayBuffer());
    const path = `lodgify-${lodgifyPropertyId}/cover.${ext}`;

    const { error } = await supabase.storage
      .from("property-images")
      .upload(path, buffer, {
        contentType,
        upsert: true,
      });

    if (error) {
      console.error(`[lodgify-sync] Failed to upload image for property ${lodgifyPropertyId}:`, error);
      return null;
    }

    const { data: publicUrl } = supabase.storage
      .from("property-images")
      .getPublicUrl(path);

    return publicUrl.publicUrl;
  } catch (err) {
    console.error(`[lodgify-sync] Error rehosting image for property ${lodgifyPropertyId}:`, err);
    return null;
  }
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/**
 * Sync all Lodgify properties into the local database.
 * Creates any that don't exist yet, updates names/addresses for existing ones.
 * Returns the number of properties created.
 */
export async function syncProperties() {
  const supabase = createAdminClient();
  const lodgifyProperties = await getProperties();

  // Ensure a host exists to assign properties to
  const { data: hosts } = await supabase
    .from("host")
    .select("id")
    .limit(1);

  let hostId: string;

  if (hosts && hosts.length > 0) {
    hostId = hosts[0].id;
  } else {
    const { data: newHost, error } = await supabase
      .from("host")
      .insert({
        auth_user_id: "00000000-0000-0000-0000-000000000000",
        email: "admin@guestportal.local",
        full_name: "Admin",
      })
      .select("id")
      .single();

    if (error || !newHost) {
      throw new Error(`Failed to create default host: ${error?.message}`);
    }
    hostId = newHost.id;
  }

  let created = 0;
  let updated = 0;

  for (const lp of lodgifyProperties) {
    const { data: existing } = await supabase
      .from("property")
      .select("id")
      .eq("lodgify_property_id", lp.id)
      .single();

    if (existing) {
      // Rehost image from Lodgify if no cover image set yet
      let coverImageUrl: string | undefined;
      if (lp.imageUrl) {
        const rehosted = await rehostImage(supabase, lp.imageUrl, lp.id);
        if (rehosted) coverImageUrl = rehosted;
      }

      await supabase
        .from("property")
        .update({
          name: lp.name,
          address: lp.address,
          description: lp.description,
          ...(coverImageUrl ? { cover_image_url: coverImageUrl } : {}),
          ...(lp.maxGuests ? { max_guests: lp.maxGuests } : {}),
        })
        .eq("id", existing.id);
      updated++;
    } else {
      const slug = slugify(lp.name);
      // Ensure unique slug
      const { data: slugExists } = await supabase
        .from("property")
        .select("id")
        .eq("slug", slug)
        .single();

      const finalSlug = slugExists ? `${slug}-${lp.id}` : slug;

      // Rehost image from Lodgify
      let coverImageUrl: string | null = null;
      if (lp.imageUrl) {
        const rehosted = await rehostImage(supabase, lp.imageUrl, lp.id);
        if (rehosted) coverImageUrl = rehosted;
      }

      const { error } = await supabase
        .from("property")
        .insert({
          host_id: hostId,
          name: lp.name,
          slug: finalSlug,
          address: lp.address,
          description: lp.description,
          lodgify_property_id: lp.id,
          is_active: true,
          ...(coverImageUrl ? { cover_image_url: coverImageUrl } : {}),
          ...(lp.maxGuests ? { max_guests: lp.maxGuests } : {}),
        });

      if (error) {
        console.error(`[lodgify-sync] Failed to create property ${lp.id}:`, error);
      } else {
        created++;
      }
    }
  }

  return { total: lodgifyProperties.length, created, updated };
}

/**
 * Ensure a Lodgify property exists locally. Creates it if not found.
 * Used by booking sync to auto-create properties on the fly.
 */
async function ensureProperty(lodgifyPropertyId: number): Promise<string | null> {
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("property")
    .select("id")
    .eq("lodgify_property_id", lodgifyPropertyId)
    .single();

  if (existing) return existing.id;

  // Property not found locally — sync all properties from Lodgify
  await syncProperties();

  // Try again
  const { data: created } = await supabase
    .from("property")
    .select("id")
    .eq("lodgify_property_id", lodgifyPropertyId)
    .single();

  return created?.id ?? null;
}

/**
 * Upsert a single Lodgify booking into the database.
 * Auto-creates the property if it doesn't exist locally.
 * Finds or creates the guest, then upserts the registration.
 */
export async function syncBooking(booking: LodgifyBooking) {
  const supabase = createAdminClient();

  // Skip unconfirmed bookings or bookings with no revenue (failed payments, inquiries)
  const shouldRemove = SKIP_STATUSES.has(booking.status) || !booking.total_amount;
  if (shouldRemove) {
    const { data: existing } = await supabase
      .from("registration")
      .select("id")
      .eq("lodgify_booking_id", booking.id)
      .maybeSingle();
    if (existing) {
      await supabase.from("vehicle").delete().eq("registration_id", existing.id);
      await supabase.from("cleaning_status").delete().eq("registration_id", existing.id);
      await supabase.from("registration_update_log").delete().eq("registration_id", existing.id);
      await supabase.from("registration").delete().eq("id", existing.id);
      const reason = SKIP_STATUSES.has(booking.status) ? `status: ${booking.status}` : "no revenue";
      console.log(`[lodgify-sync] Removed booking ${booking.id} (${reason})`);
    }
    return { skipped: true, reason: SKIP_STATUSES.has(booking.status) ? "unconfirmed" : "no_revenue" };
  }

  // 1. Find or create the property
  const propertyId = await ensureProperty(booking.property_id);

  if (!propertyId) {
    console.warn(
      `[lodgify-sync] Could not create property for lodgify_property_id=${booking.property_id}, skipping booking ${booking.id}`
    );
    return { skipped: true, reason: "unmapped_property" };
  }

  // 2. Find or create guest by lodgify_guest_id (fall back to email if id is empty)
  let existingGuest: { id: string } | null = null;

  if (booking.guest.id) {
    const { data } = await supabase
      .from("guest")
      .select("id")
      .eq("lodgify_guest_id", booking.guest.id)
      .single();
    existingGuest = data;
  }

  if (!existingGuest && booking.guest.email) {
    const { data } = await supabase
      .from("guest")
      .select("id")
      .eq("email", booking.guest.email)
      .single();
    existingGuest = data;
  }

  let guestId: string;

  if (existingGuest) {
    guestId = existingGuest.id;
    // Update guest info in case it changed
    await supabase
      .from("guest")
      .update({
        full_name: booking.guest.name,
        email: booking.guest.email,
        phone: booking.guest.phone,
        ...(booking.guest.id ? { lodgify_guest_id: booking.guest.id } : {}),
      })
      .eq("id", guestId);
  } else {
    const { data: newGuest, error: guestError } = await supabase
      .from("guest")
      .insert({
        ...(booking.guest.id ? { lodgify_guest_id: booking.guest.id } : {}),
        full_name: booking.guest.name,
        email: booking.guest.email,
        phone: booking.guest.phone,
      })
      .select("id")
      .single();

    if (guestError || !newGuest) {
      console.error(`[lodgify-sync] Failed to create guest for booking ${booking.id}:`, guestError);
      return { skipped: true, reason: "guest_create_failed" };
    }
    guestId = newGuest.id;
  }

  // 3. Check if this booking already exists (to distinguish new vs update)
  const { data: existingReg } = await supabase
    .from("registration")
    .select("id, status")
    .eq("lodgify_booking_id", booking.id)
    .maybeSingle();

  const isNewBooking = !existingReg;
  const wasPreviouslyActive = existingReg?.status === "active";

  // 4. Upsert registration by lodgify_booking_id. thread_uid is only present
  // on v2 detail fetches (webhook path); omit when null so batch syncs don't
  // overwrite a previously-cached value.
  const { error: regError } = await supabase
    .from("registration")
    .upsert(
      {
        lodgify_booking_id: booking.id,
        property_id: propertyId,
        guest_id: guestId,
        check_in_date: booking.arrival || null,
        check_out_date: booking.departure || null,
        num_guests: booking.guests || 1,
        lodgify_adults: booking.adults || 0,
        lodgify_children: booking.children || 0,
        lodgify_infants: booking.infants || 0,
        lodgify_num_pets: booking.pets || 0,
        notes: booking.notes,
        status: mapStatus(booking.status),
        booking_source: booking.source,
        ...(booking.total_amount ? { total_amount_cents: Math.round(booking.total_amount * 100) } : {}),
        ...(booking.date_created ? { booked_at: booking.date_created } : {}),
        ...(booking.thread_uid ? { lodgify_thread_uid: booking.thread_uid } : {}),
      },
      { onConflict: "lodgify_booking_id" }
    );

  if (regError) {
    console.error(`[lodgify-sync] Failed to upsert registration for booking ${booking.id}:`, regError);
    return { skipped: true, reason: "upsert_failed" };
  }

  // Backfill lodgify_booking_id on any message rows we stored before we knew
  // which booking the thread belonged to (webhook-delivered messages only
  // carry thread_uid / inbox_uid).
  if (booking.thread_uid) {
    await supabase
      .from("guest_message")
      .update({ lodgify_booking_id: booking.id })
      .eq("thread_uid", booking.thread_uid)
      .is("lodgify_booking_id", null);
    await supabase
      .from("guest_message_thread")
      .update({ lodgify_booking_id: booking.id })
      .eq("thread_uid", booking.thread_uid)
      .is("lodgify_booking_id", null);
  }

  // 5. Notify cleaners (fire-and-forget)
  const newStatus = mapStatus(booking.status);

  // Fetch the registration we just upserted for the portal link and upsells
  const { data: savedReg } = await supabase
    .from("registration")
    .select("id, upsells")
    .eq("lodgify_booking_id", booking.id)
    .single();

  const paidUpsells = ((savedReg?.upsells as Array<{ status: string; label?: string }> | null) ?? [])
    .filter((u) => u.status === "paid" && u.label)
    .map((u) => u.label!);

  const notifyParams = {
    propertyId,
    registrationId: savedReg?.id ?? "",
    guestName: booking.guest.name,
    checkIn: booking.arrival,
    checkOut: booking.departure,
    numGuests: booking.guests || 1,
    numInfants: booking.infants || 0,
    numPets: booking.pets || 0,
    notes: booking.notes || null,
    upsells: paidUpsells,
  };

  if (isNewBooking && newStatus === "active") {
    notifyCleanersOfNewBooking(notifyParams).catch((err) => {
      console.error(`[lodgify-sync] Failed to notify cleaners for booking ${booking.id}:`, err);
    });
  } else if (wasPreviouslyActive && newStatus === "cancelled") {
    notifyCleanersOfCancellation(notifyParams).catch((err) => {
      console.error(`[lodgify-sync] Failed to notify cleaners of cancellation ${booking.id}:`, err);
    });
  }

  return { skipped: false };
}

/**
 * Sync a single booking by its Lodgify ID (used by webhook handler).
 */
export async function syncBookingById(bookingId: number) {
  const booking = await getBookingById(bookingId);
  return syncBooking(booking);
}

/**
 * Sync the latest bookings from Lodgify (used by manual refresh button).
 * Fetches the most recent page of bookings and returns IDs of newly created registrations.
 */
export async function syncLatestBookings() {
  const supabase = createAdminClient();

  // Get total to find the tail end
  const { total } = await getBookings({ limit: 1 });
  const offset = Math.max(0, total - 50);
  const { items } = await getBookings({ offset, limit: 50 });

  // Check which lodgify booking IDs already exist locally
  const lodgifyIds = items.map((b) => b.id);
  const { data: existing } = await supabase
    .from("registration")
    .select("lodgify_booking_id")
    .in("lodgify_booking_id", lodgifyIds);
  const existingSet = new Set((existing || []).map((r) => r.lodgify_booking_id));

  // Sync all
  let synced = 0;
  let skipped = 0;
  for (const booking of items) {
    const result = await syncBooking(booking);
    if (result.skipped) skipped++;
    else synced++;
  }

  // Find newly created registration IDs
  const newLodgifyIds = lodgifyIds.filter((id) => !existingSet.has(id));
  const newIds: string[] = [];
  if (newLodgifyIds.length > 0) {
    const { data: newRegs } = await supabase
      .from("registration")
      .select("id")
      .in("lodgify_booking_id", newLodgifyIds);
    newIds.push(...(newRegs || []).map((r) => r.id));
  }

  return { total: items.length, synced, skipped, newIds };
}

/**
 * Sync a single batch of bookings from Lodgify.
 * Processes one page at a time to avoid function timeouts.
 * Returns next_offset when there are more bookings to process, or done: true when finished.
 */
export async function syncBookingsBatch(options?: {
  propertyId?: number;
  offset?: number;
}) {
  const PAGE_SIZE = 50;
  const offset = options?.offset ?? 0;

  // Sync properties on the first batch
  if (offset === 0) {
    await syncProperties();
  }

  const response = await getBookings({
    offset,
    limit: PAGE_SIZE,
    property_id: options?.propertyId,
  });

  let synced = 0;
  let skipped = 0;

  for (const booking of response.items) {
    const result = await syncBooking(booking);
    if (result.skipped) skipped++;
    else synced++;
  }

  const supabase = createAdminClient();

  const nextOffset = offset + response.items.length;
  const done = nextOffset >= response.total || response.items.length < PAGE_SIZE;

  // Update last synced timestamp when finished
  if (done) {
    if (options?.propertyId) {
      await supabase
        .from("property")
        .update({ lodgify_last_synced_at: new Date().toISOString() })
        .eq("lodgify_property_id", options.propertyId);
    } else {
      await supabase
        .from("property")
        .update({ lodgify_last_synced_at: new Date().toISOString() })
        .not("lodgify_property_id", "is", null);
    }
  }

  return { total: response.total, synced, skipped, offset, next_offset: done ? null : nextOffset, done };
}
