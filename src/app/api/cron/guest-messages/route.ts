import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendGuestAutomatedMessage } from "@/lib/guest-messages/send";
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
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://guest.summitlakeside.com";

  type BookingRow = {
    id: string;
    lodgify_booking_id: number;
    booking_source: string | null;
    check_in_date: string;
    check_out_date: string;
    guest: { full_name: string; email: string | null };
    property: { name: string; slug: string; nickname: string | null };
  };

  const batches: { type: GuestMessageType; query: string }[] = [
    {
      type: "pre_arrival",
      query: `check_in_date.eq.${offsetDate(3)},status.eq.active`,
    },
    {
      type: "day_of_checkin",
      query: `check_in_date.eq.${offsetDate(0)},status.eq.active`,
    },
    {
      type: "post_checkout",
      query: `check_out_date.eq.${offsetDate(-1)},status.eq.completed`,
    },
  ];

  const results: Record<string, { sent: number; skipped: number; errors: number }> = {};

  for (const batch of batches) {
    const conditions = batch.query.split(",");

    let query = supabase
      .from("registration")
      .select("id, lodgify_booking_id, booking_source, check_in_date, check_out_date, guest:guest_id(full_name, email), property:property_id(name, slug, nickname)")
      .not("booking_source", "ilike", "%airbnb%")
      .not("lodgify_booking_id", "is", null);

    for (const condition of conditions) {
      const [col, op, val] = condition.split(".");
      if (op === "eq") query = query.eq(col, val);
    }

    const { data: rows, error } = await query;

    if (error) {
      console.error(`[guest-msg-cron] Query failed for ${batch.type}:`, error);
      results[batch.type] = { sent: 0, skipped: 0, errors: 1 };
      continue;
    }

    let sent = 0, skipped = 0, errors = 0;

    for (const row of (rows ?? []) as unknown as BookingRow[]) {
      if (!row.lodgify_booking_id) { skipped++; continue; }

      const isDirect = !row.booking_source || /direct|lodgify/i.test(row.booking_source);
      const channel: GuestMessageChannel = isDirect ? "email" : "lodgify";
      const property = Array.isArray(row.property) ? row.property[0] : row.property;
      const guest = Array.isArray(row.guest) ? row.guest[0] : row.guest;

      if (!property || !guest) { skipped++; continue; }

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
        });
        sent++;
      } catch (err) {
        console.error(`[guest-msg-cron] Error sending ${batch.type} for ${row.id}:`, err);
        errors++;
      }
    }

    results[batch.type] = { sent, skipped, errors };
  }

  return NextResponse.json({ ok: true, results });
}

function offsetDate(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
