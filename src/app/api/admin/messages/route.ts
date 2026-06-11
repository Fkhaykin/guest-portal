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
      `id,
       lodgify_booking_id,
       lodgify_thread_uid,
       check_in_date,
       check_out_date,
       status,
       booking_source,
       booked_at,
       guest:guest_id ( full_name, email ),
       property:property_id ( name, nickname, lodgify_property_id )`
    );

  if (regError) {
    return NextResponse.json({ error: regError.message }, { status: 500 });
  }

  // Pull all thread summaries at once and index by thread_uid + booking_id.
  const { data: threads } = await admin
    .from("guest_message_thread")
    .select("thread_uid, lodgify_booking_id, guest_name, last_message_at, last_message_preview, unread_count");

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
    id: string;
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

  // Lodgify bookings are keyed by their Lodgify booking id; direct bookings
  // (no Lodgify id) by registration UUID, matching the "direct:<id>" thread.
  const conversations: ConversationThread[] = ((registrations ?? []) as unknown as RegRow[])
    .map((r) => {
      const isDirect = r.lodgify_booking_id == null;
      const summary = isDirect
        ? threadByUid.get(`direct:${r.id}`)
        : threadByBooking.get(r.lodgify_booking_id as number) ??
          (r.lodgify_thread_uid ? threadByUid.get(r.lodgify_thread_uid) : undefined);
      return {
        booking_id: isDirect ? r.id : (r.lodgify_booking_id as number),
        guest_name: r.guest?.full_name ?? "Unknown Guest",
        guest_email: r.guest?.email ?? null,
        property_id: r.property?.lodgify_property_id ?? 0,
        property_name: r.property?.nickname || r.property?.name || null,
        arrival: r.check_in_date ?? "",
        departure: r.check_out_date ?? "",
        status: r.status ?? "",
        source: r.booking_source ?? (isDirect ? "direct" : null),
        date_created: r.booked_at,
        last_message_at: summary?.last_message_at ?? null,
        last_message_preview: summary?.last_message_preview ?? null,
        unread_count: summary?.unread_count ?? 0,
      };
    });

  // Threads with no matching registration — inquiries and unconfirmed
  // bookings that the Lodgify sync skips. Their messages are in our DB but
  // would otherwise never appear in this list.
  const matchedBookings = new Set<number>();
  const matchedThreadUids = new Set<string>();
  for (const r of (registrations ?? []) as unknown as RegRow[]) {
    if (r.lodgify_booking_id != null) matchedBookings.add(r.lodgify_booking_id);
    if (r.lodgify_thread_uid) matchedThreadUids.add(r.lodgify_thread_uid);
    matchedThreadUids.add(`direct:${r.id}`);
  }
  for (const t of threads ?? []) {
    if (!t.thread_uid || matchedThreadUids.has(t.thread_uid)) continue;
    if (t.lodgify_booking_id != null && matchedBookings.has(t.lodgify_booking_id)) continue;
    conversations.push({
      // Threads without a booking id can only be addressed by thread_uid;
      // the detail route understands the "thread:" prefix.
      booking_id: t.lodgify_booking_id ?? `thread:${t.thread_uid}`,
      guest_name: t.guest_name ?? "Unknown Guest",
      guest_email: null,
      property_id: 0,
      property_name: null,
      arrival: "",
      departure: "",
      status: "inquiry",
      source: null,
      date_created: null,
      last_message_at: t.last_message_at,
      last_message_preview: t.last_message_preview,
      unread_count: t.unread_count ?? 0,
    });
  }

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
