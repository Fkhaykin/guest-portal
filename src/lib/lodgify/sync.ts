import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getBookings, getBookingById, getProperties, type LodgifyBooking } from "./client";
import { notifyCleanersOfNewBooking, notifyCleanersOfCancellation } from "@/lib/sms/notify-cleaners";
import {
  notifyHostOfNewBooking,
  notifyHostOfCancellation,
  notifyHostOfBookingChange,
} from "@/lib/push/notify-host";
import { sendGuestConfirmationAsync } from "@/lib/guest-messages/send";
import { submitPEPOAEmail } from "@/lib/pepoa/submit-email";

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
export async function syncBooking(booking: LodgifyBooking, options?: { skipNotify?: boolean }) {
  const supabase = createAdminClient();

  // Skip unconfirmed bookings. Don't gate on total_amount — OTA bookings (Airbnb/VRBO)
  // legitimately omit payout amounts from the API; dropping them silently prevents notifications.
  const shouldRemove = SKIP_STATUSES.has(booking.status);
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
      console.log(`[lodgify-sync] Removed booking ${booking.id} (status: ${booking.status})`);
    }
    return { skipped: true, reason: "unconfirmed" };
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
    .select("id, status, check_in_date, check_out_date, num_guests, lodgify_adults, lodgify_children, lodgify_infants, lodgify_num_pets, notes, total_amount_cents")
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

  // Fetch the registration we just upserted for the portal link, upsells, and change logging
  const { data: savedReg } = await supabase
    .from("registration")
    .select("id, upsells")
    .eq("lodgify_booking_id", booking.id)
    .single();

  // 5. Log booking-level changes from Lodgify/OTA (dates, guests, status, etc.)
  if (!isNewBooking && existingReg && savedReg) {
    // Normalize to YYYY-MM-DD so Lodgify datetime strings ("2026-04-29T00:00:00")
    // don't create false diffs against the date-typed DB column ("2026-04-29").
    const toDateStr = (val: string | null | undefined): string | null =>
      val ? val.slice(0, 10) : null;

    const newSnap = {
      check_in_date: toDateStr(booking.arrival),
      check_out_date: toDateStr(booking.departure),
      num_guests: booking.guests ?? 1,
      lodgify_adults: booking.adults ?? 0,
      lodgify_children: booking.children ?? 0,
      lodgify_infants: booking.infants ?? 0,
      lodgify_num_pets: booking.pets ?? 0,
      status: mapStatus(booking.status),
      notes: booking.notes || null,
      // Only compare revenue when we have a new value; otherwise keep old to avoid false diffs
      total_amount_cents: booking.total_amount
        ? Math.round(booking.total_amount * 100)
        : (existingReg.total_amount_cents ?? null),
    };

    const TRACKED = [
      "check_in_date", "check_out_date", "num_guests",
      "lodgify_adults", "lodgify_children", "lodgify_infants", "lodgify_num_pets",
      "status", "notes", "total_amount_cents",
    ] as const;

    const existing = existingReg as Record<string, unknown>;
    // Normalize null/"" as equivalent so empty-string vs null doesn't create spurious diffs
    const normalize = (v: unknown) => (v == null || v === "" ? null : v);
    const changedKeys = TRACKED.filter(
      (key) => JSON.stringify(normalize(existing[key])) !== JSON.stringify(normalize(newSnap[key]))
    );

    if (changedKeys.length > 0) {
      const source = booking.source
        ? booking.source.replace(/\s*integration\s*/i, "").replace(/\s*api\s*/i, "").trim().toLowerCase()
        : "lodgify";

      const LABEL: Record<string, string> = {
        check_in_date: "check-in", check_out_date: "check-out",
        num_guests: "guest count", lodgify_adults: "adults",
        lodgify_children: "children", lodgify_infants: "infants",
        lodgify_num_pets: "pets", status: "status",
        notes: "notes", total_amount_cents: "revenue",
      };

      const summaryParts = changedKeys.map((key) => {
        const label = LABEL[key] ?? key;
        const prev = existing[key];
        const next = newSnap[key];
        if (key === "total_amount_cents") {
          return `${label}: $${Math.round(((prev as number) ?? 0) / 100)} → $${Math.round(((next as number) ?? 0) / 100)}`;
        }
        return `${label}: ${prev ?? "—"} → ${next ?? "—"}`;
      });

      const prevSnap: Record<string, unknown> = {};
      const nextSnap: Record<string, unknown> = {};
      for (const key of TRACKED) {
        prevSnap[key] = existing[key] ?? null;
        nextSnap[key] = newSnap[key] ?? null;
      }

      await supabase.from("registration_update_log").insert({
        registration_id: savedReg.id,
        changed_by: source,
        change_type: "booking_modified",
        summary: summaryParts.join("; "),
        previous_data: prevSnap,
        new_data: nextSnap,
      });

      if (!options?.skipNotify) {
        // Awaited — Vercel freezes the function once the webhook response is
        // returned, killing fire-and-forget sends mid-flight.
        await notifyHostOfBookingChange({
          propertyId,
          guestName: booking.guest.name,
          summary: summaryParts.join("; "),
        }).catch((err) => {
          console.error(`[lodgify-sync] Host push failed for booking ${booking.id}:`, err);
        });
      }

      // Email HOA when check-in or check-out dates change
      const dateChanged = changedKeys.some((k) => k === "check_in_date" || k === "check_out_date");
      if (dateChanged) {
        const dateSummary = changedKeys
          .filter((k) => k === "check_in_date" || k === "check_out_date")
          .map((key) => `${LABEL[key]}: ${existing[key] ?? "—"} → ${newSnap[key] ?? "—"}`)
          .join("; ");
        await submitPEPOAEmail({ registrationId: savedReg.id, isUpdate: true, changeSummary: dateSummary }).catch((err) => {
          console.error(`[lodgify-sync] PEPOA date-change email failed for ${savedReg.id}:`, err);
        });
      }
    }
  }

  // 6. Notify cleaners (fire-and-forget)
  const newStatus = mapStatus(booking.status);

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

  // Notify on new active bookings AND on status transitions to active (e.g. booking
  // was previously in DB as completed/cancelled, or first synced before webhook fired).
  // Batch/full syncs pass skipNotify=true — notifications only fire on the webhook path.
  // All sends are awaited — Vercel freezes the function once the webhook response
  // is returned, killing fire-and-forget sends mid-flight.
  const justBecameActive = !isNewBooking && newStatus === "active" && !wasPreviouslyActive;
  if (!options?.skipNotify) {
    if ((isNewBooking || justBecameActive) && newStatus === "active") {
      await Promise.all([
        notifyCleanersOfNewBooking(notifyParams).catch((err) => {
          console.error(`[lodgify-sync] Failed to notify cleaners for booking ${booking.id}:`, err);
        }),
        notifyHostOfNewBooking(notifyParams).catch((err) => {
          console.error(`[lodgify-sync] Host push failed for booking ${booking.id}:`, err);
        }),
      ]);
    } else if (wasPreviouslyActive && newStatus === "cancelled") {
      await Promise.all([
        notifyCleanersOfCancellation(notifyParams).catch((err) => {
          console.error(`[lodgify-sync] Failed to notify cleaners of cancellation ${booking.id}:`, err);
        }),
        notifyHostOfCancellation(notifyParams).catch((err) => {
          console.error(`[lodgify-sync] Host push failed for cancellation ${booking.id}:`, err);
        }),
      ]);
    }
  }

  // Send automated guest message for non-Airbnb new/reactivated bookings
  const isAirbnb = /airbnb/i.test(booking.source ?? "");
  const isDirect = !booking.source || /direct|lodgify/i.test(booking.source ?? "");
  if (!options?.skipNotify && (isNewBooking || justBecameActive) && newStatus === "active" && !isAirbnb && savedReg) {
    await sendGuestConfirmationAsync({
      registrationId: savedReg.id,
      lodgifyBookingId: booking.id,
      channel: isDirect ? "email" : "lodgify",
      guestName: booking.guest.name,
      guestEmail: booking.guest.email ?? null,
      propertyId,
      checkInDate: booking.arrival ?? null,
      checkOutDate: booking.departure ?? null,
    }).catch((err) => console.error(`[guest-msg] Confirmation failed for booking ${booking.id}:`, err));
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

  // Sync all — use v2 detail for bookings where v1 list omits the amount
  // (common for OTA/Airbnb bookings where the payout isn't exposed on the list endpoint)
  let synced = 0;
  let skipped = 0;
  for (const booking of items) {
    let bookingToSync = booking;
    if (!booking.total_amount) {
      try {
        bookingToSync = await getBookingById(booking.id);
      } catch {
        // fall back to v1 data
      }
    }
    const result = await syncBooking(bookingToSync, { skipNotify: true });
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
    const result = await syncBooking(booking, { skipNotify: true });
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
