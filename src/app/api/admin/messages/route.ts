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

  // Pull all thread summaries at once and index by thread_uid + booking_id +
  // registration_id (web-chat threads merge into a booking by registration_id).
  const { data: threads } = await admin
    .from("guest_message_thread")
    .select("thread_uid, lodgify_booking_id, registration_id, guest_name, last_message_at, last_message_preview, unread_count, lodgify_property_id, arrival, departure, booking_status, channel, email, visitor_name");

  // House names for inquiry threads, which have no registration to join on.
  const { data: allProperties } = await admin
    .from("property")
    .select("lodgify_property_id, name, nickname");
  const propertyNameByLodgifyId = new Map<number, string>();
  for (const p of allProperties ?? []) {
    if (p.lodgify_property_id != null && !propertyNameByLodgifyId.has(p.lodgify_property_id)) {
      propertyNameByLodgifyId.set(p.lodgify_property_id, p.nickname || p.name);
    }
  }

  type Summary = {
    last_message_at: string | null;
    last_message_preview: string | null;
    unread_count: number;
  };
  // Combine two thread summaries into one conversation row: keep the most recent
  // message, sum the unread counts (a guest who chats then books has a web
  // thread + a booking thread that must read as one conversation).
  const mergeSummary = (
    a: Summary | undefined,
    b: Summary | undefined
  ): Summary | undefined => {
    if (!a) return b;
    if (!b) return a;
    const newer = (b.last_message_at ?? "") > (a.last_message_at ?? "") ? b : a;
    return {
      last_message_at: newer.last_message_at,
      last_message_preview: newer.last_message_preview,
      unread_count: (a.unread_count ?? 0) + (b.unread_count ?? 0),
    };
  };

  const threadByBooking = new Map<number, Summary>();
  const threadByUid = new Map<string, Summary>();
  const threadByRegistration = new Map<string, Summary>();
  for (const t of threads ?? []) {
    const summary: Summary = {
      last_message_at: t.last_message_at,
      last_message_preview: t.last_message_preview,
      unread_count: t.unread_count ?? 0,
    };
    if (t.lodgify_booking_id != null) threadByBooking.set(t.lodgify_booking_id, summary);
    if (t.thread_uid) threadByUid.set(t.thread_uid, summary);
    // A reservation may have several linked threads (direct + multi-device web).
    if (t.registration_id) {
      threadByRegistration.set(
        t.registration_id,
        mergeSummary(threadByRegistration.get(t.registration_id), summary) as Summary
      );
    }
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
      // Direct bookings: direct + web messages are both keyed by registration_id.
      // Lodgify bookings: the OTA thread by booking id/uid, plus any linked web
      // thread folded in by registration_id.
      const summary = isDirect
        ? threadByRegistration.get(r.id)
        : mergeSummary(
            threadByBooking.get(r.lodgify_booking_id as number) ??
              (r.lodgify_thread_uid ? threadByUid.get(r.lodgify_thread_uid) : undefined),
            threadByRegistration.get(r.id)
          );
      return {
        booking_id: isDirect ? r.id : (r.lodgify_booking_id as number),
        registration_id: r.id,
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
    // Linked web threads are already folded into their booking's conversation
    // above — don't surface them again as standalone rows.
    if (t.registration_id) continue;
    const isWeb = t.channel === "web";
    conversations.push({
      // Web threads are answerable, addressed by their raw "web:<uuid>" uid.
      // Other orphan threads (OTA inquiries) use the "thread:" prefix.
      booking_id: isWeb
        ? t.thread_uid
        : t.lodgify_booking_id ?? `thread:${t.thread_uid}`,
      // Orphan threads (enquiries / unlinked web chats) have no reservation.
      registration_id: null,
      guest_name: (isWeb ? t.visitor_name : t.guest_name) ?? "Unknown Guest",
      guest_email: isWeb ? t.email ?? null : null,
      property_id: t.lodgify_property_id ?? 0,
      property_name:
        t.lodgify_property_id != null
          ? propertyNameByLodgifyId.get(t.lodgify_property_id) ?? null
          : null,
      arrival: t.arrival ?? "",
      departure: t.departure ?? "",
      // Lodgify calls inquiries "Open" — keep the friendlier label.
      status:
        t.booking_status && t.booking_status.toLowerCase() !== "open"
          ? t.booking_status.toLowerCase()
          : "inquiry",
      // Enquiries have no registration/booking_source; the channel the thread
      // arrived on (Vrbo/Airbnb/…) is the only source we can show.
      source: t.channel ?? null,
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
