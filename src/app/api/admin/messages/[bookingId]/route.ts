import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchMessagesForBooking,
  fetchThreadMessages,
  sendMessage,
  type LodgifyMessage,
} from "@/lib/lodgify/messages";
import {
  isRegistrationId,
  directThreadUid,
  sendDirectGuestMessage,
} from "@/lib/guest-messages/direct";

type GuestMessageRow = {
  id?: string;
  lodgify_message_id: number | null;
  thread_uid: string;
  message_type: string;
  subject: string | null;
  message: string;
  creation_time: string | null;
  guest_name: string | null;
  has_attachments: boolean;
};

function toLodgifyMessage(row: GuestMessageRow): LodgifyMessage {
  const type = row.message_type || "Comment";
  return {
    id: String(row.lodgify_message_id ?? row.id),
    message: row.message,
    subject: row.subject ?? "",
    type,
    created_at: row.creation_time ?? "",
    sender_name: type === "Owner" ? "You" : row.guest_name ?? "Guest",
  };
}

async function upsertMessages(
  admin: ReturnType<typeof createAdminClient>,
  threadUid: string,
  bookingId: number,
  messages: LodgifyMessage[]
) {
  if (!messages.length) return;
  const rows = messages
    .filter((m) => m.id && /^\d+$/.test(m.id))
    .map((m) => ({
      lodgify_message_id: Number(m.id),
      thread_uid: threadUid,
      lodgify_booking_id: bookingId,
      message_type: m.type || "Comment",
      subject: m.subject ?? null,
      message: m.message ?? "",
      creation_time: m.created_at || null,
      guest_name: m.type === "Owner" ? null : m.sender_name,
    }));
  if (!rows.length) return;
  await admin
    .from("guest_message")
    .upsert(rows, { onConflict: "lodgify_message_id", ignoreDuplicates: false });

  // Refresh thread summary from the latest message in the batch.
  const latest = [...messages].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))[0];
  if (latest) {
    await admin
      .from("guest_message_thread")
      .upsert(
        {
          thread_uid: threadUid,
          lodgify_booking_id: bookingId,
          last_message_at: latest.created_at || null,
          last_message_preview: (latest.message ?? "").slice(0, 200),
          guest_name: latest.type === "Owner" ? null : latest.sender_name,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "thread_uid" }
      );
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { bookingId } = await params;

  // Threads with no linked booking (inquiries the sync skips) are addressed
  // by "thread:<thread_uid>" — read straight from our DB.
  if (bookingId.startsWith("thread:")) {
    const threadUid = bookingId.slice("thread:".length);
    const admin = createAdminClient();
    const { data: rows } = await admin
      .from("guest_message")
      .select("id, lodgify_message_id, thread_uid, message_type, subject, message, creation_time, guest_name, has_attachments")
      .eq("thread_uid", threadUid)
      .order("creation_time", { ascending: true });
    // Opening the thread marks it read.
    await admin
      .from("guest_message_thread")
      .update({ unread_count: 0 })
      .eq("thread_uid", threadUid);
    return NextResponse.json({
      messages: (rows ?? []).map((r) => toLodgifyMessage(r as GuestMessageRow)),
    });
  }

  // Direct bookings are addressed by registration UUID; their thread lives
  // entirely in our DB under "direct:<registration_id>".
  if (isRegistrationId(bookingId)) {
    const admin = createAdminClient();
    const threadUid = directThreadUid(bookingId);
    const { data: rows } = await admin
      .from("guest_message")
      .select("id, lodgify_message_id, thread_uid, message_type, subject, message, creation_time, guest_name, has_attachments")
      .eq("thread_uid", threadUid)
      .order("creation_time", { ascending: true });
    // Opening the thread marks it read.
    await admin
      .from("guest_message_thread")
      .update({ unread_count: 0 })
      .eq("thread_uid", threadUid);
    return NextResponse.json({
      messages: (rows ?? []).map((r) => toLodgifyMessage(r as GuestMessageRow)),
    });
  }

  const id = Number(bookingId);
  if (!id || isNaN(id)) {
    return NextResponse.json({ error: "Invalid booking ID" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Resolve thread_uid from registration if we have it cached.
  const { data: reg } = await admin
    .from("registration")
    .select("id, lodgify_thread_uid")
    .eq("lodgify_booking_id", id)
    .maybeSingle();

  let threadUid = reg?.lodgify_thread_uid ?? null;

  // Prefer DB reads — order by creation_time so oldest is first.
  let messages: LodgifyMessage[] = [];
  if (threadUid) {
    const { data: rows } = await admin
      .from("guest_message")
      .select("lodgify_message_id, thread_uid, message_type, subject, message, creation_time, guest_name, has_attachments")
      .eq("thread_uid", threadUid)
      .order("creation_time", { ascending: true });
    messages = (rows ?? []).map((r) => toLodgifyMessage(r as GuestMessageRow));
  } else {
    // Thread not known — try by booking_id (webhook-written rows where we
    // resolved the booking link afterwards).
    const { data: rows } = await admin
      .from("guest_message")
      .select("lodgify_message_id, thread_uid, message_type, subject, message, creation_time, guest_name, has_attachments")
      .eq("lodgify_booking_id", id)
      .order("creation_time", { ascending: true });
    if (rows && rows.length) {
      threadUid = (rows[0] as GuestMessageRow).thread_uid;
      messages = rows.map((r) => toLodgifyMessage(r as GuestMessageRow));
    }
  }

  // Fallback: if we have nothing in DB yet, hit Lodgify and cache the result.
  if (messages.length === 0) {
    const live = await fetchMessagesForBooking(id);
    messages = live;

    // Cache to DB for next time. We need thread_uid to upsert — pull from the
    // live response if we don't have it yet (the v2 thread endpoint doesn't
    // echo thread_uid, so derive from fetchMessagesForBooking -> booking
    // detail lookup, which is already inside that call).
    if (!threadUid) {
      // fetchMessagesForBooking has already resolved thread_uid internally;
      // re-fetch it here via the booking detail so we can persist.
      try {
        const res = await fetch(
          `https://api.lodgify.com/v2/reservations/bookings/${id}`,
          {
            headers: {
              "X-ApiKey": process.env.LODGIFY_API_KEY ?? "",
              Accept: "application/json",
            },
            cache: "no-store",
          }
        );
        if (res.ok) {
          const detail = (await res.json()) as { thread_uid?: string };
          threadUid = detail.thread_uid ?? null;
          if (threadUid && reg?.id) {
            await admin
              .from("registration")
              .update({ lodgify_thread_uid: threadUid })
              .eq("id", reg.id);
          }
        }
      } catch (err) {
        console.error("[admin-messages] Failed to resolve thread_uid:", err);
      }
    }

    if (threadUid && live.length) {
      await upsertMessages(admin, threadUid, id, live);
    }
  }

  // Opening the thread marks it read.
  if (threadUid) {
    await admin
      .from("guest_message_thread")
      .update({ unread_count: 0 })
      .eq("thread_uid", threadUid);
  }

  return NextResponse.json({ messages });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { bookingId } = await params;

  const body = await request.json();
  const text = body?.message;
  if (!text || typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  // Lodgify's send API is booking-scoped; a thread with no booking can only
  // be answered from the Lodgify/Airbnb inbox.
  if (bookingId.startsWith("thread:")) {
    return NextResponse.json(
      { error: "This conversation isn't linked to a booking yet — reply from your Lodgify or Airbnb inbox." },
      { status: 400 }
    );
  }

  // Direct booking: deliver to the guest's email/phone and record locally.
  if (isRegistrationId(bookingId)) {
    const result = await sendDirectGuestMessage(bookingId, text.trim());
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }
    return NextResponse.json({ success: true });
  }

  const id = Number(bookingId);
  if (!id || isNaN(id)) {
    return NextResponse.json({ error: "Invalid booking ID" }, { status: 400 });
  }

  const result = await sendMessage(id, text.trim());
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  // Pull the thread back from Lodgify to capture our just-sent Owner message
  // and persist it so the admin UI reads from DB.
  const admin = createAdminClient();
  const { data: reg } = await admin
    .from("registration")
    .select("id, lodgify_thread_uid")
    .eq("lodgify_booking_id", id)
    .maybeSingle();
  const threadUid = reg?.lodgify_thread_uid ?? null;
  if (threadUid) {
    try {
      const live = await fetchThreadMessages(threadUid);
      await upsertMessages(admin, threadUid, id, live);
    } catch (err) {
      console.error("[admin-messages] Post-send backfill failed:", err);
    }
  }

  return NextResponse.json({ success: true });
}
