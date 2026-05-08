import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendGuestAutomatedMessage } from "@/lib/guest-messages/send";
import { sendRegistrationReminder, REMINDER_DAYS, type ReminderDay } from "@/lib/guest-messages/reminders";
import type { GuestMessageType, GuestMessageChannel } from "@/lib/guest-messages/templates";

export const maxDuration = 60;

// GET /api/cron/guest-messages
// Called by Vercel cron daily at 9am UTC.
// Sends pre-arrival (3 days out), day-of, and post-checkout messages to non-Airbnb guests.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createAdminClient();

  type BookingRow = {
    id: string;
    lodgify_booking_id: number;
    booking_source: string | null;
    check_in_date: string;
    check_out_date: string;
    guest: { full_name: string; email: string | null };
    property: { name: string; slug: string; nickname: string | null; host_id: string };
  };

  const batches: { type: GuestMessageType; dateCol: string; dateVal: string; status: string }[] = [
    { type: "pre_arrival",    dateCol: "check_in_date",  dateVal: offsetDate(3),  status: "active" },
    { type: "day_of_checkin", dateCol: "check_in_date",  dateVal: offsetDate(0),  status: "active" },
    { type: "post_checkout",  dateCol: "check_out_date", dateVal: offsetDate(-1), status: "completed" },
  ];

  const results: Record<string, { sent: number; skipped: number; errors: number }> = {};

  for (const batch of batches) {
    const { data: rows, error } = await supabase
      .from("registration")
      .select("id, lodgify_booking_id, booking_source, check_in_date, check_out_date, guest:guest_id(full_name, email), property:property_id(name, slug, nickname, host_id)")
      .eq(batch.dateCol, batch.dateVal)
      .eq("status", batch.status)
      .not("booking_source", "ilike", "%airbnb%")
      .not("lodgify_booking_id", "is", null);

    if (error) {
      console.error(`[guest-msg-cron] Query failed for ${batch.type}:`, error);
      results[batch.type] = { sent: 0, skipped: 0, errors: 1 };
      continue;
    }

    let sent = 0, skipped = 0, errors = 0;

    for (const row of (rows ?? []) as unknown as BookingRow[]) {
      if (!row.lodgify_booking_id) { skipped++; continue; }

      const property = Array.isArray(row.property) ? row.property[0] : row.property;
      const guest = Array.isArray(row.guest) ? row.guest[0] : row.guest;
      if (!property || !guest) { skipped++; continue; }

      const isDirect = !row.booking_source || /direct|lodgify/i.test(row.booking_source);
      const channel: GuestMessageChannel = isDirect ? "email" : "lodgify";

      try {
        await sendGuestAutomatedMessage({
          registrationId: row.id,
          lodgifyBookingId: row.lodgify_booking_id,
          messageType: batch.type,
          channel,
          guestName: guest.full_name,
          guestEmail: guest.email,
          propertyName: property.nickname || property.name,
          propertySlug: property.slug,
          checkInDate: row.check_in_date,
          checkOutDate: row.check_out_date,
          hostId: property.host_id,
        });
        sent++;
      } catch (err) {
        console.error(`[guest-msg-cron] Error sending ${batch.type} for ${row.id}:`, err);
        errors++;
      }
    }

    results[batch.type] = { sent, skipped, errors };
  }

  // Registration reminders — for unregistered (no signature_url) bookings,
  // sent at 10, 7, 6, 5, 4, 3, 2, and 1 days before check-in.
  type ReminderRow = {
    id: string;
    lodgify_booking_id: number | null;
    booking_source: string | null;
    check_in_date: string;
    check_out_date: string;
    signature_url: string | null;
    guest: { full_name: string; email: string | null; phone: string | null };
    property: { name: string; slug: string; nickname: string | null; host_id: string };
  };

  const reminderResults: Record<string, { sent: number; skipped: number; errors: number }> = {};

  for (const days of REMINDER_DAYS) {
    const targetDate = offsetDate(days);
    const { data: rows, error } = await supabase
      .from("registration")
      .select("id, lodgify_booking_id, booking_source, check_in_date, check_out_date, signature_url, guest:guest_id(full_name, email, phone), property:property_id(name, slug, nickname, host_id)")
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

  return NextResponse.json({ ok: true, results, reminders: reminderResults });
}

function offsetDate(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
