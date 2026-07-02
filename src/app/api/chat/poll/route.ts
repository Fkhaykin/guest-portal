import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isWebThreadUid, loadWebThread } from "@/lib/guest-messages/web";
import { verifyGuestToken } from "@/lib/guest-token";

type Row = {
  id: string;
  message_type: string;
  message: string | null;
  creation_time: string | null;
};

// The widget renders from the visitor's perspective: the host's replies are
// "Owner", everything else is the guest's own message.
function toWidgetMessage(r: Row) {
  return {
    id: String(r.id),
    from: r.message_type === "Owner" ? "host" : "you",
    message: r.message ?? "",
    created_at: r.creation_time ?? "",
  };
}

// Public: the web-chat widget polls for new messages. An anonymous visitor
// passes { threadUid, token }; a logged-in guest passes { registrationId,
// guestToken } and gets their whole reservation conversation (so host replies
// sent by email/SMS on the booking thread show up in the widget too). Pass
// ?after=<ISO timestamp> to fetch only newer messages.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const after = searchParams.get("after")?.trim();
  const registrationId = searchParams.get("registrationId")?.trim();
  // The guest token authorizes the whole guest API surface, so keep it out of
  // the URL (access logs, history, referer) — read it from the header, like the
  // other /api/guest/* routes.
  const guestToken = request.headers.get("x-guest-token")?.trim();

  const admin = createAdminClient();

  // Authenticated guest: return the full booking conversation.
  if (registrationId && guestToken) {
    if (!verifyGuestToken(registrationId, guestToken)) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }
    // Web-chat and direct email/SMS messages are keyed by registration_id, but
    // OTA (Lodgify/Airbnb/Vrbo) host replies are keyed by lodgify_booking_id —
    // union both so the guest sees replies on every channel. Derive the booking
    // id from the verified registration; never trust a client-supplied one.
    const { data: reg } = await admin
      .from("registration")
      .select("lodgify_booking_id")
      .eq("id", registrationId)
      .maybeSingle();
    const lodgifyBookingId = reg?.lodgify_booking_id ?? null;

    let query = admin
      .from("guest_message")
      .select("id, message_type, message, creation_time")
      .in("message_type", ["Owner", "Renter"])
      .order("creation_time", { ascending: true });
    query =
      lodgifyBookingId != null
        ? query.or(
            `registration_id.eq.${registrationId},lodgify_booking_id.eq.${lodgifyBookingId}`
          )
        : query.eq("registration_id", registrationId);
    if (after) query = query.gt("creation_time", after);
    const { data: rows } = await query;
    return NextResponse.json({
      messages: (rows ?? []).map((r) => toWidgetMessage(r as Row)),
    });
  }

  const threadUid = searchParams.get("threadUid")?.trim();
  const token = searchParams.get("token")?.trim();

  if (!threadUid || !isWebThreadUid(threadUid) || !token) {
    return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  }

  const thread = await loadWebThread(threadUid);
  if (!thread || !thread.web_token || thread.web_token !== token) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  let query = admin
    .from("guest_message")
    .select("id, message_type, message, creation_time")
    .eq("thread_uid", threadUid)
    .order("creation_time", { ascending: true });
  if (after) query = query.gt("creation_time", after);

  const { data: rows } = await query;
  return NextResponse.json({
    messages: (rows ?? []).map((r) => toWidgetMessage(r as Row)),
  });
}
