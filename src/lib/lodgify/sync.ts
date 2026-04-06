import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getBookings, getBookingById, getProperties, type LodgifyBooking } from "./client";

const STATUS_MAP: Record<string, "active" | "completed" | "cancelled"> = {
  Booked: "active",
  Tentative: "active",
  Open: "active",
  CheckedOut: "completed",
  Cancelled: "cancelled",
  Declined: "cancelled",
};

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
    const res = await fetch(imageUrl);
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

  // 1. Find or create the property
  const propertyId = await ensureProperty(booking.property_id);

  if (!propertyId) {
    console.warn(
      `[lodgify-sync] Could not create property for lodgify_property_id=${booking.property_id}, skipping booking ${booking.id}`
    );
    return { skipped: true, reason: "unmapped_property" };
  }

  // 2. Find or create guest by lodgify_guest_id
  const { data: existingGuest } = await supabase
    .from("guest")
    .select("id")
    .eq("lodgify_guest_id", booking.guest.id)
    .single();

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
      })
      .eq("id", guestId);
  } else {
    const { data: newGuest, error: guestError } = await supabase
      .from("guest")
      .insert({
        lodgify_guest_id: booking.guest.id,
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

  // 3. Upsert registration by lodgify_booking_id
  const totalAmountCents = booking.total_amount
    ? Math.round(booking.total_amount * 100)
    : 0;

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
        lodgify_num_pets: booking.pets || 0,
        notes: booking.notes,
        status: mapStatus(booking.status),
        booking_source: booking.source,
        total_amount_cents: totalAmountCents,
      },
      { onConflict: "lodgify_booking_id" }
    );

  if (regError) {
    console.error(`[lodgify-sync] Failed to upsert registration for booking ${booking.id}:`, regError);
    return { skipped: true, reason: "upsert_failed" };
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
 * Full sync: sync properties from Lodgify, then pull all bookings and upsert them.
 */
export async function syncAllBookings(options?: {
  propertyId?: number;
}) {
  // Sync properties first
  await syncProperties();

  const PAGE_SIZE = 50;
  let offset = 0;
  let synced = 0;
  let skipped = 0;
  let total = 0;

  while (true) {
    const response = await getBookings({
      offset,
      limit: PAGE_SIZE,
      property_id: options?.propertyId,
    });

    total = response.total;

    for (const booking of response.items) {
      const result = await syncBooking(booking);
      if (result.skipped) {
        skipped++;
      } else {
        synced++;
      }
    }

    offset += response.items.length;
    if (offset >= total || response.items.length < PAGE_SIZE) break;
  }

  // Update last synced timestamp on properties
  const supabase = createAdminClient();
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

  return { total, synced, skipped };
}
