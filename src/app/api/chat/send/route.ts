import { NextRequest, NextResponse } from "next/server";
import {
  isWebThreadUid,
  loadWebThread,
  recordWebMessage,
} from "@/lib/guest-messages/web";
import { notifyHostOfGuestMessage } from "@/lib/push/notify-host";

// Public, unauthenticated: a web-chat visitor sends a message. Gated by the
// per-thread token issued at /api/chat/start.
export async function POST(request: NextRequest) {
  let body: { threadUid?: string; token?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const threadUid = body.threadUid?.trim();
  const token = body.token?.trim();
  const text = body.message?.trim().slice(0, 4000);

  if (!threadUid || !isWebThreadUid(threadUid) || !token) {
    return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  }
  if (!text) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const thread = await loadWebThread(threadUid);
  if (!thread || !thread.web_token || thread.web_token !== token) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  await recordWebMessage({
    threadUid,
    type: "Renter",
    text,
    visitorName: thread.visitor_name,
    registrationId: thread.registration_id,
    incrementUnread: true,
  });

  await notifyHostOfGuestMessage({
    guestName: thread.visitor_name,
    preview: text.slice(0, 140),
    lodgifyBookingId: thread.lodgify_booking_id,
    registrationId: thread.registration_id,
    threadKey:
      thread.lodgify_booking_id ?? thread.registration_id ?? thread.thread_uid,
  }).catch((err) => console.error("[chat/send] Host notify failed:", err));

  return NextResponse.json({ success: true });
}
