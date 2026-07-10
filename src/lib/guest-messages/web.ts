import { randomBytes } from "crypto";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { scheduleSentimentRefresh } from "@/lib/guest-messages/sentiment";

// Website live chat (channel = "web"). Anonymous visitors start a conversation
// from the marketing site before they have any booking. Threads live in the
// shared guest_message / guest_message_thread tables, addressed by thread_uid
// "web:<uuid>", and carry a per-thread secret token (no guest auth exists for
// anonymous visitors). When a booking later arrives with the same email,
// linkWebThreadsToReservation merges the thread into that booking's timeline.

const FROM = "Summit Lakeside <contact@summitlakeside.com>";
// Inbound reply domain (Resend receiving). When unset, no thread reply-to is
// added and guest replies go to the From mailbox instead of the thread.
const REPLY_DOMAIN = process.env.DIRECT_REPLY_EMAIL_DOMAIN?.trim() || null;

const WEB_PREFIX = "web:";

export function isWebThreadUid(param: string): boolean {
  return param.startsWith(WEB_PREFIX);
}

export function newWebThreadUid(): string {
  return `${WEB_PREFIX}${crypto.randomUUID()}`;
}

export function generateWebToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Outbound reply-to that routes a guest's email reply back into a web thread. */
export function webReplyAddressFor(threadUid: string): string | null {
  if (!REPLY_DOMAIN || !isWebThreadUid(threadUid)) return null;
  const uuid = threadUid.slice(WEB_PREFIX.length);
  return `reply+web-${uuid}@${REPLY_DOMAIN}`;
}

/**
 * Extract the web thread_uid from a reply+web-<uuid>@<domain> recipient. The
 * "web-" prefix keeps this from matching the direct reply+<uuid>@ scheme.
 */
export function webThreadUidFromReplyAddress(
  addresses: string[]
): string | null {
  for (const addr of addresses) {
    const match = addr.match(
      /reply\+web-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})@/i
    );
    if (match) return `${WEB_PREFIX}${match[1].toLowerCase()}`;
  }
  return null;
}

export type WebThread = {
  thread_uid: string;
  web_token: string | null;
  email: string | null;
  phone: string | null;
  visitor_name: string | null;
  registration_id: string | null;
  lodgify_booking_id: number | null;
};

export async function loadWebThread(
  threadUid: string
): Promise<WebThread | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("guest_message_thread")
    .select("thread_uid, web_token, email, phone, visitor_name, registration_id, lodgify_booking_id")
    .eq("thread_uid", threadUid)
    .eq("channel", "web")
    .maybeSingle();
  return (data as WebThread) ?? null;
}

/** Insert a message row and refresh the thread summary for a web thread. */
export async function recordWebMessage(params: {
  threadUid: string;
  type: "Owner" | "Renter";
  text: string;
  visitorName: string | null;
  // Stamp the linked reservation so messages created after a thread is linked
  // still merge into that booking's timeline (matched by registration_id).
  registrationId?: string | null;
  createdAt?: string;
  incrementUnread?: boolean;
}): Promise<void> {
  const admin = createAdminClient();
  const createdAt = params.createdAt ?? new Date().toISOString();

  await admin.from("guest_message").insert({
    thread_uid: params.threadUid,
    message_type: params.type,
    channel: "web",
    message: params.text,
    guest_name: params.type === "Owner" ? null : params.visitorName,
    creation_time: createdAt,
    ...(params.registrationId ? { registration_id: params.registrationId } : {}),
  });

  let unread: number | undefined;
  if (params.incrementUnread) {
    const { data: thread } = await admin
      .from("guest_message_thread")
      .select("unread_count")
      .eq("thread_uid", params.threadUid)
      .maybeSingle();
    unread = (thread?.unread_count ?? 0) + 1;
  }

  // Omit web_token / email / phone so a summary refresh never clobbers the
  // values set when the thread was created.
  await admin.from("guest_message_thread").upsert(
    {
      thread_uid: params.threadUid,
      channel: "web",
      last_message_at: createdAt,
      last_message_preview: params.text.slice(0, 200),
      ...(params.visitorName ? { guest_name: params.visitorName } : {}),
      ...(unread != null ? { unread_count: unread } : {}),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "thread_uid" }
  );

  // New inbound guest message on a booking-linked thread → re-evaluate the
  // review-request sentiment flag. Unlinked visitor chats have no booking, so
  // there's no review request to gate.
  if (params.type === "Renter" && params.registrationId) {
    scheduleSentimentRefresh({ registrationId: params.registrationId });
  }
}

/**
 * Merge unlinked web threads for an email into a reservation: stamp
 * registration_id (+ lodgify_booking_id) onto the threads and their messages so
 * the conversation continues across the chat -> booking boundary. Idempotent —
 * only touches rows where registration_id is still null.
 */
export async function linkWebThreadsToReservation(
  email: string | null | undefined,
  registrationId: string,
  lodgifyBookingId: number | null
): Promise<{ linked: number }> {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return { linked: 0 };
  const admin = createAdminClient();

  const stamp = {
    registration_id: registrationId,
    ...(lodgifyBookingId != null ? { lodgify_booking_id: lodgifyBookingId } : {}),
  };

  // 1. Link any unlinked web threads for this email to the reservation.
  await admin
    .from("guest_message_thread")
    .update({ ...stamp, updated_at: new Date().toISOString() })
    .eq("channel", "web")
    .is("registration_id", null)
    .ilike("email", normalized);

  // 2. Re-read ALL web threads now linked to this reservation and stamp any of
  //    their still-unlinked messages. Working off this set (not just the rows
  //    updated in step 1) makes the function self-healing: the two updates
  //    aren't transactional, so a prior run that linked a thread but failed to
  //    stamp its messages is repaired here on the next call.
  const { data: linkedThreads } = await admin
    .from("guest_message_thread")
    .select("thread_uid")
    .eq("channel", "web")
    .eq("registration_id", registrationId);

  const uids = (linkedThreads ?? []).map((t) => t.thread_uid as string);
  if (uids.length) {
    await admin
      .from("guest_message")
      .update(stamp)
      .is("registration_id", null)
      .in("thread_uid", uids);
  }

  return { linked: uids.length };
}

/**
 * Send a host reply for a web thread: store the Owner message and email the
 * visitor (with a reply-to that routes their response back into the thread).
 * The live widget also surfaces the message via polling.
 */
export async function sendWebHostMessage(
  threadUid: string,
  text: string
): Promise<{ success: boolean; error?: string }> {
  const thread = await loadWebThread(threadUid);
  if (!thread) return { success: false, error: "Web thread not found" };

  // Always record the Owner message so it shows in the widget + admin UI, even
  // if the visitor left no email or the email send fails.
  await recordWebMessage({
    threadUid,
    type: "Owner",
    text,
    visitorName: thread.visitor_name,
    registrationId: thread.registration_id,
  });

  if (thread.email) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const replyTo = webReplyAddressFor(threadUid);
      const { error } = await resend.emails.send({
        from: FROM,
        to: thread.email,
        ...(replyTo ? { replyTo } : {}),
        subject: "Re: your message to Summit Lakeside",
        text: `${text}\n\n—\nSummit Lakeside · Reply to this email to respond.`,
      });
      if (error) {
        console.warn(`[web-msg] Email send failed for ${threadUid}:`, error.message);
      }
    } catch (err) {
      console.warn(`[web-msg] Email send threw for ${threadUid}:`, err);
    }
  }

  return { success: true };
}
