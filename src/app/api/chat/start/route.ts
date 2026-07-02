import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  newWebThreadUid,
  generateWebToken,
  recordWebMessage,
  linkWebThreadsToReservation,
} from "@/lib/guest-messages/web";
import { notifyHostOfGuestMessage } from "@/lib/push/notify-host";
import { verifyGuestToken } from "@/lib/guest-token";

// Public: starts a web-chat conversation. Anonymous visitors send name/email/
// phone; a guest already looked up their reservation sends { registrationId,
// guestToken } instead, so we skip the form and link straight to their booking.
// Returns a thread_uid + secret token the widget uses for subsequent send/poll.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Best-effort per-IP throttle on thread creation (the abuse vector). In-memory
// only — resets on cold start, but blunts bursts from a single warm instance.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 5;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > RATE_MAX;
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a minute." },
      { status: 429 }
    );
  }

  let body: {
    name?: string;
    email?: string;
    phone?: string;
    message?: string;
    registrationId?: string;
    guestToken?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const firstMessage = body.message?.trim().slice(0, 4000) || null;

  // Authenticated guest: they already looked up their reservation, so we know
  // who they are — skip the form and pull identity from the booking.
  if (
    typeof body.registrationId === "string" &&
    typeof body.guestToken === "string"
  ) {
    const started = await startForKnownGuest(
      body.registrationId.trim(),
      body.guestToken.trim(),
      firstMessage
    );
    return NextResponse.json(started.body, { status: started.status });
  }

  const name = body.name?.trim().slice(0, 200);
  const email = body.email?.trim().toLowerCase();
  const phone = body.phone?.trim().slice(0, 40) || null;

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "A valid email is required" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const threadUid = newWebThreadUid();
  const token = generateWebToken();

  const { error: insertError } = await admin
    .from("guest_message_thread")
    .insert({
      thread_uid: threadUid,
      channel: "web",
      web_token: token,
      email,
      phone,
      visitor_name: name,
      guest_name: name,
      unread_count: 0,
      updated_at: new Date().toISOString(),
    });
  if (insertError) {
    console.error("[chat/start] Failed to create thread:", insertError);
    return NextResponse.json({ error: "Could not start chat" }, { status: 500 });
  }

  if (firstMessage) {
    await recordWebMessage({
      threadUid,
      type: "Renter",
      text: firstMessage,
      visitorName: name,
      incrementUnread: true,
    });
  }

  // Silently link to an existing reservation if this email already booked, so
  // the conversation merges into that booking. Never reveal whether it matched.
  let linkedRegistrationId: string | null = null;
  let linkedLodgifyBookingId: number | null = null;
  try {
    // Email is not unique on guest (Lodgify/JotForm imports create duplicates),
    // so gather every matching guest and take their most recent reservation.
    const { data: guests } = await admin
      .from("guest")
      .select("id")
      .ilike("email", email)
      .limit(20);
    const guestIds = (guests ?? []).map((g) => g.id as string);
    if (guestIds.length) {
      const { data: reg } = await admin
        .from("registration")
        .select("id, lodgify_booking_id")
        .in("guest_id", guestIds)
        .order("check_in_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (reg) {
        await linkWebThreadsToReservation(
          email,
          reg.id,
          reg.lodgify_booking_id ?? null
        );
        linkedRegistrationId = reg.id;
        linkedLodgifyBookingId = reg.lodgify_booking_id ?? null;
      }
    }
  } catch (err) {
    console.error("[chat/start] Link-by-email failed:", err);
  }

  if (firstMessage) {
    // Deep-link the host push to wherever the inbox addresses this conversation:
    // a Lodgify booking by numeric id, a direct booking by registration id, or
    // (unlinked) the web thread itself.
    const deepLinkKey =
      linkedLodgifyBookingId ?? linkedRegistrationId ?? threadUid;
    await notifyHostOfGuestMessage({
      guestName: name,
      preview: firstMessage.slice(0, 140),
      lodgifyBookingId: linkedLodgifyBookingId,
      registrationId: linkedRegistrationId,
      threadKey: deepLinkKey,
    }).catch((err) => console.error("[chat/start] Host notify failed:", err));
  }

  return NextResponse.json({ threadUid, token });
}

/**
 * Start (or resume) a web-chat thread for a guest who has already looked up
 * their reservation. The guest token is an HMAC of the registration id, so it
 * both authenticates the guest and identifies the booking — no form needed.
 * The thread is pre-linked to the reservation so it merges into that booking's
 * conversation immediately.
 */
async function startForKnownGuest(
  registrationId: string,
  guestToken: string,
  firstMessage: string | null
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!verifyGuestToken(registrationId, guestToken)) {
    return { status: 401, body: { error: "Invalid session" } };
  }

  const admin = createAdminClient();
  const { data: reg } = await admin
    .from("registration")
    .select("id, lodgify_booking_id, guest:guest_id ( full_name, email, phone )")
    .eq("id", registrationId)
    .maybeSingle();
  if (!reg) return { status: 404, body: { error: "Reservation not found" } };

  const guest = (reg as unknown as {
    guest: { full_name: string | null; email: string | null; phone: string | null } | null;
  }).guest;
  const lodgifyBookingId =
    (reg as unknown as { lodgify_booking_id: number | null }).lodgify_booking_id ??
    null;
  const guestName = guest?.full_name ?? null;

  // Resume the guest's existing web thread for this reservation, if any, so a
  // returning guest continues one conversation instead of spawning new threads.
  const { data: existing } = await admin
    .from("guest_message_thread")
    .select("thread_uid, web_token")
    .eq("channel", "web")
    .eq("registration_id", registrationId)
    .not("web_token", "is", null)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  let threadUid: string;
  let token: string;
  if (existing?.thread_uid && existing.web_token) {
    threadUid = existing.thread_uid;
    token = existing.web_token;
  } else {
    threadUid = newWebThreadUid();
    token = generateWebToken();
    const { error: insertError } = await admin
      .from("guest_message_thread")
      .insert({
        thread_uid: threadUid,
        channel: "web",
        web_token: token,
        email: guest?.email ?? null,
        phone: guest?.phone ?? null,
        visitor_name: guestName,
        guest_name: guestName,
        registration_id: registrationId,
        ...(lodgifyBookingId != null ? { lodgify_booking_id: lodgifyBookingId } : {}),
        unread_count: 0,
        updated_at: new Date().toISOString(),
      });
    if (insertError) {
      console.error("[chat/start] Failed to create guest thread:", insertError);
      return { status: 500, body: { error: "Could not start chat" } };
    }
  }

  if (firstMessage) {
    await recordWebMessage({
      threadUid,
      type: "Renter",
      text: firstMessage,
      visitorName: guestName,
      registrationId,
      incrementUnread: true,
    });
    await notifyHostOfGuestMessage({
      guestName,
      preview: firstMessage.slice(0, 140),
      lodgifyBookingId,
      registrationId,
      threadKey: lodgifyBookingId ?? registrationId,
    }).catch((err) => console.error("[chat/start] Host notify failed:", err));
  }

  return { status: 200, body: { threadUid, token, registrationId } };
}
