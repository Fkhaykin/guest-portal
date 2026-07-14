// Scheduled guest-message sends, shared by the morning and evening cron
// routes. All Lodgify auto-messages are turned off — this is now the only
// source of automated guest messaging, so Airbnb bookings are included
// (their messages relay through the Lodgify thread, channel "lodgify").
import { createAdminClient } from "@/lib/supabase/admin";
import { sendGuestAutomatedMessage, sendHouseCheckinInstructions } from "@/lib/guest-messages/send";
import { sendRegistrationReminder, REMINDER_DAYS, type ReminderDay } from "@/lib/guest-messages/reminders";
import { shouldRequestReview } from "@/lib/guest-messages/sentiment";
import { lateCheckoutAvailability, hostPropertyIds } from "@/lib/upsells/availability";
import { channelForBookingSource } from "@/lib/guest-messages/templates";
import type { GuestMessageType } from "@/lib/guest-messages/templates";
import type { UpsellEntry } from "@/types/database";

type BookingRow = {
  id: string;
  lodgify_booking_id: number;
  booking_source: string | null;
  check_in_date: string;
  check_out_date: string;
  signature_url: string | null;
  upsells: UpsellEntry[] | null;
  review_request_disabled: boolean;
  review_request_forced: boolean;
  review_request_skipped_at: string | null;
  guest: { full_name: string; email: string | null; phone: string | null };
  property: { name: string; slug: string; nickname: string | null; host_id: string };
};

export type BatchResult = { sent: number; skipped: number; errors: number };

const BOOKING_SELECT =
  "id, lodgify_booking_id, booking_source, check_in_date, check_out_date, signature_url, upsells, review_request_disabled, review_request_forced, review_request_skipped_at, guest:guest_id(full_name, email, phone), property:property_id(name, slug, nickname, host_id)";

export function offsetDate(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function fetchBookings(
  dateCol: "check_in_date" | "check_out_date",
  dateVal: string,
  statuses: string[]
): Promise<BookingRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("registration")
    .select(BOOKING_SELECT)
    .eq(dateCol, dateVal)
    .in("status", statuses)
    .not("lodgify_booking_id", "is", null);
  if (error) throw new Error(`Query failed: ${error.message}`);
  return (data ?? []) as unknown as BookingRow[];
}

type BatchOptions = {
  /** Also send the per-house check-in instructions after the main message. */
  withHouseInstructions?: boolean;
  /** Skip rows failing this predicate (counted as skipped). */
  filter?: (row: BookingRow) => boolean | Promise<boolean>;
};

async function runBatch(
  type: GuestMessageType,
  rows: BookingRow[],
  options?: BatchOptions
): Promise<BatchResult> {
  let sent = 0, skipped = 0, errors = 0;

  for (const row of rows) {
    const property = Array.isArray(row.property) ? row.property[0] : row.property;
    const guest = Array.isArray(row.guest) ? row.guest[0] : row.guest;
    if (!property || !guest || !row.lodgify_booking_id) { skipped++; continue; }
    // Owner blocks sync as regular bookings with a "Owner block — ..." guest.
    // They currently no-op anyway (no email/phone), but never target them.
    if (/^owner block/i.test(guest.full_name ?? "")) { skipped++; continue; }

    try {
      if (options?.filter && !(await options.filter(row))) { skipped++; continue; }

      const sendParams = {
        registrationId: row.id,
        lodgifyBookingId: row.lodgify_booking_id,
        messageType: type,
        channel: channelForBookingSource(row.booking_source),
        guestName: guest.full_name,
        guestEmail: guest.email,
        guestPhone: guest.phone,
        propertyName: property.nickname || property.name,
        propertySlug: property.slug,
        checkInDate: row.check_in_date,
        checkOutDate: row.check_out_date,
        hostId: property.host_id,
        upsells: row.upsells,
        registered: !!row.signature_url,
      };
      // For check-in morning, the per-house instructions already lead with the
      // dates/times, so they REPLACE the generic day_of_checkin for known
      // houses (avoids two back-to-back messages). Fall back to day_of_checkin
      // only when there's nothing house-specific to send.
      if (options?.withHouseInstructions) {
        const handled = await sendHouseCheckinInstructions(sendParams);
        if (!handled) await sendGuestAutomatedMessage(sendParams);
      } else {
        await sendGuestAutomatedMessage(sendParams);
      }
      sent++;
    } catch (err) {
      console.error(`[guest-msg-cron] Error sending ${type} for ${row.id}:`, err);
      errors++;
    }
  }

  return { sent, skipped, errors };
}

async function safeBatch(
  results: Record<string, BatchResult>,
  type: GuestMessageType,
  fetcher: () => Promise<BookingRow[]>,
  options?: BatchOptions
) {
  try {
    results[type] = await runBatch(type, await fetcher(), options);
  } catch (err) {
    console.error(`[guest-msg-cron] Batch ${type} failed:`, err);
    results[type] = { sent: 0, skipped: 0, errors: 1 };
  }
}

/** True if the guest has sent any message since their check-in date. */
async function guestHasMessagedSince(lodgifyBookingId: number, sinceDate: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("guest_message")
    .select("lodgify_message_id")
    .eq("lodgify_booking_id", lodgifyBookingId)
    .eq("message_type", "Renter")
    .gte("creation_time", `${sinceDate}T00:00:00Z`)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

function nights(row: BookingRow): number {
  return Math.round(
    (Date.parse(row.check_out_date) - Date.parse(row.check_in_date)) / 86_400_000
  );
}

/** True if pre_arrival has already been logged for this booking this run. */
async function preArrivalAlreadySent(registrationId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("guest_automated_message_log")
    .select("id")
    .eq("registration_id", registrationId)
    .eq("message_type", "pre_arrival")
    .maybeSingle();
  return !!data;
}

/**
 * Morning sends (cron at 12:00 UTC ≈ 8am ET):
 * - pre_arrival: 3 days before check-in
 * - day_of_checkin + per-house check-in instructions: morning of check-in
 * - checkout_morning: morning of check-out
 * - post_checkout review request: morning after check-out, sentiment-gated
 * - registration reminders for unregistered guests
 */
export async function runMorningSends() {
  const results: Record<string, BatchResult> = {};

  await safeBatch(results, "pre_arrival", () =>
    fetchBookings("check_in_date", offsetDate(3), ["active"]));

  await safeBatch(results, "day_of_checkin",
    () => fetchBookings("check_in_date", offsetDate(0), ["active"]),
    { withHouseInstructions: true });

  await safeBatch(results, "checkout_morning", () =>
    fetchBookings("check_out_date", offsetDate(0), ["active"]));

  // Review request the morning after checkout. Status may still be "active"
  // if Lodgify hasn't flipped it to CheckedOut yet — dedup makes this safe.
  await safeBatch(results, "post_checkout",
    () => fetchBookings("check_out_date", offsetDate(-1), ["active", "completed"]),
    {
      filter: async (row) => {
        // Admin kill switch from the reservation detail page — checked before
        // the sentiment gate so a muted booking never burns an LLM call.
        if (row.review_request_disabled) {
          console.log(`[guest-msg-cron] Skipping review request for ${row.id}: disabled by admin`);
          return false;
        }
        // Admin manually forced the request on, overriding the sentiment gate.
        if (row.review_request_forced) {
          console.log(`[guest-msg-cron] Forcing review request for ${row.id}: manual admin override`);
          return true;
        }
        const gate = await shouldRequestReview(row.lodgify_booking_id, row.id);
        if (!gate.send) {
          console.log(`[guest-msg-cron] Skipping review request for ${row.id}: ${gate.reason}`);
          // Persist the auto-skip so the reservation detail page can show the
          // admin that the system detected problems and withheld the review
          // ask. This is the final call for the booking.
          await createAdminClient()
            .from("registration")
            .update({
              review_request_skipped_at: new Date().toISOString(),
              review_request_skip_reason: gate.reason,
            })
            .eq("id", row.id);
        } else if (row.review_request_skipped_at) {
          // Mid-stay evaluations flagged a planned skip, but the final gate
          // says the conversation is fine — clear the flag so the page shows
          // the sent message instead of a stale warning.
          await createAdminClient()
            .from("registration")
            .update({ review_request_skipped_at: null, review_request_skip_reason: null })
            .eq("id", row.id);
        }
        return gate.send;
      },
    });

  const reminders = await runRegistrationReminders();
  return { results, reminders };
}

/**
 * Evening sends (cron at 22:00 UTC ≈ 6pm ET):
 * - settling_in: evening of check-in (after the 4pm check-in)
 * - pulse_check: night 2 of stays longer than 2 nights, only when the guest
 *   hasn't sent any message since check-in
 * - late_checkout_offer: night before check-out, only when the guest hasn't
 *   bought late check-out and the slot is still freely purchasable
 */
export async function runEveningSends() {
  const results: Record<string, BatchResult> = {};

  await safeBatch(results, "settling_in", () =>
    fetchBookings("check_in_date", offsetDate(0), ["active"]));

  await safeBatch(results, "pulse_check",
    () => fetchBookings("check_in_date", offsetDate(-1), ["active"]),
    {
      filter: async (row) => {
        if (nights(row) < 3) return false;
        return !(await guestHasMessagedSince(row.lodgify_booking_id, row.check_in_date));
      },
    });

  await safeBatch(results, "late_checkout_offer",
    () => fetchBookings("check_out_date", offsetDate(1), ["active"]),
    {
      filter: async (row) => {
        // One-night stays get settling_in this same evening — don't stack a
        // sales pitch on top of the welcome.
        if (nights(row) < 2) return false;
        // Any existing late-checkout entry (paid, pending, or requested)
        // means the guest already acted on it — nothing to offer.
        if ((row.upsells ?? []).some((u) => u.type === "late_checkout")) return false;
        // Only offer what the portal will actually sell instantly: the
        // message promises "booking guarantees the time", so skip when the
        // turnaround caps make the slot blocked or request-only.
        const property = Array.isArray(row.property) ? row.property[0] : row.property;
        if (!property) return false;
        const supabase = createAdminClient();
        const propertyIds = await hostPropertyIds(supabase, property.host_id);
        const avail = await lateCheckoutAvailability(
          supabase,
          { propertyIds, excludeRegistrationId: row.id },
          row.check_out_date
        );
        return avail.available && !avail.requestOnly;
      },
    });

  return { results };
}

type ReminderRow = {
  id: string;
  lodgify_booking_id: number | null;
  booking_source: string | null;
  check_in_date: string;
  check_out_date: string;
  signature_url: string | null;
  upsells: UpsellEntry[] | null;
  guest: { full_name: string; email: string | null; phone: string | null };
  property: { name: string; slug: string; nickname: string | null; host_id: string };
};

async function runRegistrationReminders() {
  const supabase = createAdminClient();
  const reminderResults: Record<string, BatchResult> = {};

  for (const days of REMINDER_DAYS) {
    const targetDate = offsetDate(days);
    const { data: rows, error } = await supabase
      .from("registration")
      .select("id, lodgify_booking_id, booking_source, check_in_date, check_out_date, signature_url, upsells, guest:guest_id(full_name, email, phone), property:property_id(name, slug, nickname, host_id)")
      .eq("check_in_date", targetDate)
      .eq("status", "active")
      .is("signature_url", null);

    if (error) {
      console.error(`[reminder-cron] Query failed for d${days}:`, error);
      reminderResults[`d${days}`] = { sent: 0, skipped: 0, errors: 1 };
      continue;
    }

    let sent = 0, skipped = 0, errors = 0;

    for (const row of (rows ?? []) as unknown as ReminderRow[]) {
      const property = Array.isArray(row.property) ? row.property[0] : row.property;
      const guest = Array.isArray(row.guest) ? row.guest[0] : row.guest;
      if (!property || !guest) { skipped++; continue; }

      // pre_arrival fires earlier in the same morning run to every active
      // booking 3 days out and already carries the registration link, so skip
      // the d3 reminder when it went out (avoids two near-identical emails the
      // same morning). If pre_arrival was disabled/unsent, the reminder stands.
      if (days === 3 && (await preArrivalAlreadySent(row.id))) { skipped++; continue; }

      try {
        const result = await sendRegistrationReminder({
          registrationId: row.id,
          lodgifyBookingId: row.lodgify_booking_id,
          daysUntilCheckin: days as ReminderDay,
          bookingSource: row.booking_source,
          guestName: guest.full_name,
          guestEmail: guest.email,
          guestPhone: guest.phone,
          propertyName: property.nickname || property.name,
          propertySlug: property.slug,
          checkInDate: row.check_in_date,
          checkOutDate: row.check_out_date,
          hostId: property.host_id,
          upsells: row.upsells,
        });
        if (result === "sent") sent++;
        else skipped++;
      } catch (err) {
        console.error(`[reminder-cron] Error sending d${days} for ${row.id}:`, err);
        errors++;
      }
    }

    reminderResults[`d${days}`] = { sent, skipped, errors };
  }

  return reminderResults;
}
