import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  recordDirectMessage,
  registrationIdFromReplyAddress,
  stripQuotedReply,
} from "@/lib/guest-messages/direct";
import {
  webThreadUidFromReplyAddress,
  loadWebThread,
  recordWebMessage,
} from "@/lib/guest-messages/web";
import { notifyHostOfGuestMessage } from "@/lib/push/notify-host";

// Resend inbound webhook: guests replying to direct-booking emails land here.
// The reply-to we send is reply+<registration_id>@<reply domain>, so the
// recipient address routes the message into the right thread. The webhook
// only carries metadata — the body is fetched via the Receiving API.

export async function POST(request: NextRequest) {
  const payload = await request.text();

  const secret = process.env.RESEND_INBOUND_WEBHOOK_SECRET;
  const resend = new Resend(process.env.RESEND_API_KEY);
  if (secret) {
    try {
      resend.webhooks.verify({
        payload,
        headers: {
          id: request.headers.get("svix-id") ?? "",
          timestamp: request.headers.get("svix-timestamp") ?? "",
          signature: request.headers.get("svix-signature") ?? "",
        },
        webhookSecret: secret,
      });
    } catch {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  } else {
    console.warn("[email-inbound] RESEND_INBOUND_WEBHOOK_SECRET not set — skipping verification");
  }

  let event: {
    type?: string;
    data?: { email_id?: string; from?: string; to?: string[]; subject?: string };
  };
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (event.type !== "email.received" || !event.data?.email_id) {
    return NextResponse.json({ ignored: true });
  }

  const { data: email, error } = await resend.emails.receiving.get(
    event.data.email_id
  );
  if (error || !email) {
    console.error("[email-inbound] Failed to fetch email body:", error);
    return NextResponse.json({ error: "Fetch failed" }, { status: 502 });
  }

  const admin = createAdminClient();

  const rawText =
    email.text ?? (email.html ? email.html.replace(/<[^>]+>/g, " ") : "");
  const text = stripQuotedReply(rawText);
  if (!text) return NextResponse.json({ ignored: true });

  const senderEmail = email.from.match(/<([^>]+)>/)?.[1] ?? email.from;

  // Record an inbound reply on a web-chat thread and notify the host.
  const routeToWebThread = async (thread: {
    thread_uid: string;
    visitor_name: string | null;
    registration_id: string | null;
    lodgify_booking_id?: number | null;
  }) => {
    await recordWebMessage({
      threadUid: thread.thread_uid,
      type: "Renter",
      text,
      visitorName: thread.visitor_name,
      registrationId: thread.registration_id,
      incrementUnread: true,
    });
    await notifyHostOfGuestMessage({
      guestName: thread.visitor_name,
      preview: text.slice(0, 140),
      lodgifyBookingId: thread.lodgify_booking_id ?? null,
      registrationId: thread.registration_id,
      threadKey:
        thread.lodgify_booking_id ?? thread.registration_id ?? thread.thread_uid,
    }).catch((err) => console.error("[email-inbound] Host push failed:", err));
  };

  // Primary: registration id encoded in the reply+<uuid>@ recipient.
  let registrationId = registrationIdFromReplyAddress(email.to ?? []);

  // Pre-booking web-chat reply: reply+web-<uuid>@ routes here while the thread
  // has no reservation. Once linked to a booking, the host replies via the
  // direct reply+<uuid>@ scheme, so those land on the registration path instead.
  if (!registrationId) {
    const webThreadUid = webThreadUidFromReplyAddress(email.to ?? []);
    if (webThreadUid) {
      // Confirm the thread exists AND the sender matches the visitor on file.
      // The web thread uid travels in the plaintext reply-to of every host
      // email (reply+web-<uuid>@), so it is NOT a secret — without a sender
      // check anyone could inject forged "guest" messages into a thread.
      const thread = await loadWebThread(webThreadUid);
      const senderMatches =
        thread?.email &&
        thread.email.trim().toLowerCase() === senderEmail.trim().toLowerCase();
      if (thread && senderMatches) {
        await routeToWebThread(thread);
      } else if (thread) {
        console.warn(
          `[email-inbound] Sender ${senderEmail} does not match web thread ${webThreadUid} — ignoring.`
        );
      }
      return NextResponse.json({ success: true });
    }
  }

  // Fallback: match the sender to a guest and take their latest direct booking.
  if (!registrationId) {
    const { data: guest } = await admin
      .from("guest")
      .select("id")
      .ilike("email", senderEmail.trim())
      .maybeSingle();
    if (guest) {
      const { data: reg } = await admin
        .from("registration")
        .select("id")
        .eq("guest_id", guest.id)
        .is("lodgify_booking_id", null)
        .order("check_in_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      registrationId = reg?.id ?? null;
    }
  }

  // Still nothing: the sender may have replied from a mail client that stripped
  // the plus-address. Route to their latest orphan web-chat thread, if any.
  if (!registrationId) {
    const { data: webThread } = await admin
      .from("guest_message_thread")
      .select("thread_uid, visitor_name, registration_id")
      .eq("channel", "web")
      .is("registration_id", null)
      .ilike("email", senderEmail.trim())
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (webThread) {
      await routeToWebThread(webThread);
      return NextResponse.json({ success: true });
    }
  }

  if (!registrationId) {
    console.warn("[email-inbound] Could not resolve registration for", email.from);
    return NextResponse.json({ ignored: true });
  }

  // Confirm the registration exists (plus-addresses are guessable).
  const { data: reg } = await admin
    .from("registration")
    .select("id, guest:guest_id ( full_name )")
    .eq("id", registrationId)
    .maybeSingle();
  if (!reg) return NextResponse.json({ ignored: true });
  const guestName =
    (reg as unknown as { guest: { full_name: string | null } | null }).guest
      ?.full_name ?? null;

  await recordDirectMessage({
    registrationId,
    type: "Renter",
    text,
    channel: "email",
    guestName,
    incrementUnread: true,
  });

  // Awaited — Vercel can freeze the function once the response is returned,
  // killing an in-flight push.
  await notifyHostOfGuestMessage({
    guestName,
    preview: text.slice(0, 140),
    lodgifyBookingId: null,
    registrationId,
  }).catch((err) => {
    console.error("[email-inbound] Host push failed:", err);
  });

  return NextResponse.json({ success: true });
}
