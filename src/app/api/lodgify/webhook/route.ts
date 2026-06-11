import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { syncBookingById } from "@/lib/lodgify/sync";
import { fetchThreadMessages } from "@/lib/lodgify/messages";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyHostOfGuestMessage } from "@/lib/push/notify-host";

function verifySignature(rawBody: string, signature: string, secrets: string[]): boolean {
  // Lodgify sends signatures as "sha256=<UPPERCASE hex>". createHmac emits
  // lowercase, so we normalize before constant-time comparison.
  const received = Buffer.from(signature.toLowerCase());
  for (const secret of secrets) {
    const expected = Buffer.from(
      "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex")
    );
    if (expected.length !== received.length) continue;
    if (timingSafeEqual(expected, received)) return true;
  }
  return false;
}

type LogEntry = {
  action: string | null;
  lodgify_booking_id: number | null;
  signature_present: boolean;
  signature_valid: boolean | null;
  status_code: number;
  outcome: string;
  skip_reason: string | null;
  error_message: string | null;
  duration_ms: number;
  raw_payload: unknown;
  headers: Record<string, string>;
};

async function writeLog(entry: LogEntry) {
  try {
    const supabase = createAdminClient();
    await supabase.from("lodgify_webhook_log").insert({
      action: entry.action,
      lodgify_booking_id: entry.lodgify_booking_id,
      signature_present: entry.signature_present,
      signature_valid: entry.signature_valid,
      status_code: entry.status_code,
      outcome: entry.outcome,
      skip_reason: entry.skip_reason,
      error_message: entry.error_message,
      duration_ms: entry.duration_ms,
      raw_payload: entry.raw_payload,
      headers: entry.headers,
    });
  } catch (err) {
    console.error("[lodgify-webhook] Failed to persist log:", err);
  }
}

function safeHeaders(request: Request): Record<string, string> {
  const out: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    if (key === "ms-signature") {
      out[key] = value ? `present(len=${value.length})` : "missing";
    } else if (key === "authorization" || key === "cookie") {
      out[key] = "[redacted]";
    } else {
      out[key] = value;
    }
  });
  return out;
}

type GuestMessageEvent = {
  action?: string;
  message?: string;
  subject?: string;
  inbox_uid?: string;
  guest_name?: string;
  message_id?: number;
  thread_uid?: string;
  sub_owner_id?: string | null;
  creation_time?: string;
  has_attachments?: boolean;
};

type BookingEvent = {
  action?: string;
  event?: string;
  booking_id?: number;
  booking?: { id?: number };
};

type LodgifyEvent = BookingEvent & GuestMessageEvent;

const BOOKING_ACTIONS = new Set([
  "booking_new_any_status",
  "booking_new_status_booked",
  "booking_change",
  "booking_status_change",
]);

// inbox_uid for Airbnb threads encodes the booking id as "B<digits>".
// Best-effort parse — we only use it to hint at a linked booking.
function parseBookingIdFromInboxUid(inboxUid: string | undefined | null): number | null {
  if (!inboxUid) return null;
  const match = /^B(\d+)$/.exec(inboxUid);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isFinite(id) ? id : null;
}

async function persistGuestMessage(event: GuestMessageEvent): Promise<{ outcome: string; skip_reason?: string }> {
  const supabase = createAdminClient();
  const messageId = event.message_id;
  const threadUid = event.thread_uid;
  if (!messageId || !threadUid) {
    return { outcome: "message_skipped", skip_reason: "missing message_id or thread_uid" };
  }

  const bookingIdHint = parseBookingIdFromInboxUid(event.inbox_uid);
  const creationTime = event.creation_time ?? null;

  // Distinguish first delivery from a Lodgify retry so the unread count
  // isn't bumped twice for the same message.
  const { data: existingMsg } = await supabase
    .from("guest_message")
    .select("lodgify_message_id")
    .eq("lodgify_message_id", messageId)
    .maybeSingle();
  const isNewMessage = !existingMsg;

  // Upsert the message row by lodgify_message_id so retries are idempotent.
  const { error: msgErr } = await supabase
    .from("guest_message")
    .upsert(
      {
        lodgify_message_id: messageId,
        thread_uid: threadUid,
        inbox_uid: event.inbox_uid ?? null,
        lodgify_booking_id: bookingIdHint,
        message_type: "Renter",
        guest_name: event.guest_name ?? null,
        subject: event.subject ?? null,
        message: event.message ?? "",
        has_attachments: event.has_attachments ?? false,
        sub_owner_id: event.sub_owner_id ?? null,
        creation_time: creationTime,
      },
      { onConflict: "lodgify_message_id" }
    );
  if (msgErr) throw new Error(`guest_message upsert failed: ${msgErr.message}`);

  // Upsert the thread summary row so the admin list can read from DB.
  const preview = (event.message ?? "").slice(0, 200);
  const { data: existingThread } = await supabase
    .from("guest_message_thread")
    .select("unread_count")
    .eq("thread_uid", threadUid)
    .maybeSingle();
  const unreadCount = (existingThread?.unread_count ?? 0) + (isNewMessage ? 1 : 0);
  const { error: threadErr } = await supabase
    .from("guest_message_thread")
    .upsert(
      {
        thread_uid: threadUid,
        inbox_uid: event.inbox_uid ?? null,
        lodgify_booking_id: bookingIdHint,
        guest_name: event.guest_name ?? null,
        last_message_at: creationTime,
        last_message_preview: preview,
        unread_count: unreadCount,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "thread_uid" }
    );
  if (threadErr) throw new Error(`guest_message_thread upsert failed: ${threadErr.message}`);

  // Push the new message to the host's devices. Awaited — Vercel can freeze
  // the function as soon as the response is returned, killing in-flight sends.
  await notifyHostOfGuestMessage({
    guestName: event.guest_name ?? null,
    preview,
    lodgifyBookingId: bookingIdHint,
  }).catch((err) => {
    console.error("[lodgify-webhook] Host push failed:", err);
  });

  // Best-effort: pull full thread from Lodgify to backfill Owner replies and
  // older messages. We don't await completion beyond a short budget — the
  // webhook needs to ack quickly so Lodgify doesn't retry.
  await backfillThread(threadUid).catch((err) => {
    console.error(`[lodgify-webhook] Thread backfill failed for ${threadUid}:`, err);
  });

  return { outcome: "message_synced" };
}

async function backfillThread(threadUid: string): Promise<void> {
  const messages = await fetchThreadMessages(threadUid);
  if (!messages.length) return;

  const supabase = createAdminClient();
  const rows = messages
    .filter((m) => m.id && /^\d+$/.test(m.id))
    .map((m) => ({
      lodgify_message_id: Number(m.id),
      thread_uid: threadUid,
      message_type: m.type || "Comment",
      subject: m.subject ?? null,
      message: m.message ?? "",
      creation_time: m.created_at || null,
      guest_name: m.type === "Owner" ? null : m.sender_name,
    }));
  if (!rows.length) return;

  const { error } = await supabase
    .from("guest_message")
    .upsert(rows, { onConflict: "lodgify_message_id", ignoreDuplicates: false });
  if (error) console.error("[lodgify-webhook] Thread backfill upsert:", error.message);
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const rawBody = await request.text();
  const headers = safeHeaders(request);

  const log: LogEntry = {
    action: null,
    lodgify_booking_id: null,
    signature_present: false,
    signature_valid: null,
    status_code: 200,
    outcome: "unknown",
    skip_reason: null,
    error_message: null,
    duration_ms: 0,
    raw_payload: null,
    headers,
  };

  // Parse upfront so we can log the payload even if signature verification fails.
  // Lodgify sends most events as an array: [{ action, booking: { id }, ... }].
  // guest_message_received is sent as a single object.
  let parsed: LodgifyEvent | LodgifyEvent[] | null = null;
  let firstEvent: LodgifyEvent | null = null;
  try {
    parsed = rawBody ? JSON.parse(rawBody) : null;
    log.raw_payload = parsed;
    firstEvent = Array.isArray(parsed) ? parsed[0] ?? null : parsed;
    log.action = firstEvent?.action ?? firstEvent?.event ?? null;
    log.lodgify_booking_id = firstEvent?.booking?.id ?? firstEvent?.booking_id ?? null;
  } catch {
    log.raw_payload = { _parse_error: true, _body_preview: rawBody.slice(0, 500) };
  }

  const signingSecrets = process.env.LODGIFY_WEBHOOK_SIGNING_SECRETS;
  const signature = request.headers.get("ms-signature") ?? "";
  log.signature_present = signature.length > 0;

  if (signingSecrets && signature.length > 0) {
    // Only verify when Lodgify actually sends a signature. Old subscriptions
    // (created before signing was configured) send no ms-signature header and
    // are allowed through so they don't break silently after the env var is set.
    const secrets = signingSecrets.split(",").map((s) => s.trim()).filter(Boolean);
    const valid = verifySignature(rawBody, signature, secrets);
    log.signature_valid = valid;
    if (!valid) {
      log.status_code = 401;
      log.outcome = "signature_invalid";
      log.error_message = "Invalid ms-signature header";
      log.duration_ms = Date.now() - startedAt;
      console.error(`[lodgify-webhook] Invalid signature for ${log.action ?? "?"} booking=${log.lodgify_booking_id ?? "?"}`);
      await writeLog(log);
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  } else if (!signingSecrets) {
    log.signature_valid = null;
  }

  if (!parsed || !firstEvent) {
    log.status_code = 400;
    log.outcome = "invalid_json";
    log.error_message = log.error_message ?? "Request body is not valid JSON";
    log.duration_ms = Date.now() - startedAt;
    console.error("[lodgify-webhook] Invalid JSON body");
    await writeLog(log);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = log.action;

  // Guest message events: persist to DB so the admin UI can read from our DB.
  if (action === "guest_message_received") {
    try {
      const result = await persistGuestMessage(firstEvent);
      log.status_code = 200;
      log.outcome = result.outcome;
      log.skip_reason = result.skip_reason ?? null;
      log.duration_ms = Date.now() - startedAt;
      await writeLog(log);
      return NextResponse.json({ ok: true, ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      log.status_code = 500;
      log.outcome = "message_failed";
      log.error_message = message;
      log.duration_ms = Date.now() - startedAt;
      console.error("[lodgify-webhook] Guest message persist failed:", message);
      await writeLog(log);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // Booking events: sync the booking into our DB.
  if (action && BOOKING_ACTIONS.has(action)) {
    const bookingId = log.lodgify_booking_id;
    if (!bookingId) {
      log.status_code = 400;
      log.outcome = "missing_booking_id";
      log.error_message = "Payload missing booking.id or booking_id";
      log.duration_ms = Date.now() - startedAt;
      console.error("[lodgify-webhook] Missing booking id in payload");
      await writeLog(log);
      return NextResponse.json({ error: "Missing booking id" }, { status: 400 });
    }

    try {
      const result = await syncBookingById(bookingId);
      log.status_code = 200;
      if (result.skipped) {
        log.outcome = "sync_skipped";
        log.skip_reason = result.reason ?? null;
      } else {
        log.outcome = "sync_ok";
      }
      log.duration_ms = Date.now() - startedAt;
      await writeLog(log);
      return NextResponse.json({ ok: true, ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      // Treat Lodgify 404 as a skip, not a failure. These are manual test
      // pings with fake booking ids (e.g. 12345678) — returning 500 would
      // just trigger retries for bookings that will never exist.
      if (/Lodgify API error 404/.test(message)) {
        log.status_code = 200;
        log.outcome = "sync_skipped";
        log.skip_reason = "booking_not_found";
        log.duration_ms = Date.now() - startedAt;
        await writeLog(log);
        return NextResponse.json({ ok: true, skipped: true, reason: "booking_not_found" });
      }
      log.status_code = 500;
      log.outcome = "sync_failed";
      log.error_message = message;
      log.duration_ms = Date.now() - startedAt;
      console.error(`[lodgify-webhook] Error syncing booking ${bookingId}:`, message);
      await writeLog(log);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // Unknown/unsupported action — ack with 200 so Lodgify doesn't retry.
  log.status_code = 200;
  log.outcome = "action_ignored";
  log.skip_reason = action ? `unsupported action: ${action}` : "missing action";
  log.duration_ms = Date.now() - startedAt;
  await writeLog(log);
  return NextResponse.json({ ok: true, ignored: true, action });
}
