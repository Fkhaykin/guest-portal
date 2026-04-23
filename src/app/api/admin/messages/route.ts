import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ConversationThread } from "@/lib/lodgify/messages";

// Conversation list is built from our local registration + guest_message_thread
// tables — populated by Lodgify webhooks and the backfill endpoint. No live
// Lodgify reads here; use /api/admin/messages/backfill to refresh stale data.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: registrations, error: regError } = await admin
    .from("registration")
    .select(
      `lodgify_booking_id,
       lodgify_thread_uid,
       check_in_date,
       check_out_date,
       status,
       booking_source,
       booked_at,
       guest:guest_id ( full_name, email ),
       property:property_id ( name, nickname, lodgify_property_id )`
    )
    .not("lodgify_booking_id", "is", null);

  if (regError) {
    return NextResponse.json({ error: regError.message }, { status: 500 });
  }

  // Pull all thread summaries at once and index by thread_uid + booking_id.
  const { data: threads } = await admin
    .from("guest_message_thread")
    .select("thread_uid, lodgify_booking_id, last_message_at, last_message_preview, unread_count");

  const threadByBooking = new Map<number, {
    last_message_at: string | null;
    last_message_preview: string | null;
    unread_count: number;
  }>();
  const threadByUid = new Map<string, {
    last_message_at: string | null;
    last_message_preview: string | null;
    unread_count: number;
  }>();
  for (const t of threads ?? []) {
    const summary = {
      last_message_at: t.last_message_at,
      last_message_preview: t.last_message_preview,
      unread_count: t.unread_count ?? 0,
    };
    if (t.lodgify_booking_id != null) threadByBooking.set(t.lodgify_booking_id, summary);
    if (t.thread_uid) threadByUid.set(t.thread_uid, summary);
  }

  type RegRow = {
    lodgify_booking_id: number | null;
    lodgify_thread_uid: string | null;
    check_in_date: string | null;
    check_out_date: string | null;
    status: string | null;
    booking_source: string | null;
    booked_at: string | null;
    guest: { full_name: string | null; email: string | null } | null;
    property: {
      name: string | null;
      nickname: string | null;
      lodgify_property_id: number | null;
    } | null;
  };

  const conversations: ConversationThread[] = ((registrations ?? []) as unknown as RegRow[])
    .filter((r) => r.lodgify_booking_id != null)
    .map((r) => {
      const bookingId = r.lodgify_booking_id as number;
      const summary =
        threadByBooking.get(bookingId) ??
        (r.lodgify_thread_uid ? threadByUid.get(r.lodgify_thread_uid) : undefined);
      return {
        booking_id: bookingId,
        guest_name: r.guest?.full_name ?? "Unknown Guest",
        guest_email: r.guest?.email ?? null,
        property_id: r.property?.lodgify_property_id ?? 0,
        property_name: r.property?.nickname || r.property?.name || null,
        arrival: r.check_in_date ?? "",
        departure: r.check_out_date ?? "",
        status: r.status ?? "",
        source: r.booking_source,
        date_created: r.booked_at,
        last_message_at: summary?.last_message_at ?? null,
        last_message_preview: summary?.last_message_preview ?? null,
        unread_count: summary?.unread_count ?? 0,
      };
    });

  // Sort: last message first (desc), then most recently booked.
  conversations.sort((a, b) => {
    const ax = a.last_message_at ?? "";
    const bx = b.last_message_at ?? "";
    if (ax !== bx) return bx.localeCompare(ax);
    const ad = a.date_created ?? "";
    const bd = b.date_created ?? "";
    return bd.localeCompare(ad);
  });

  return NextResponse.json({ conversations });
}
