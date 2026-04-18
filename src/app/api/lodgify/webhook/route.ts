import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { syncBookingById } from "@/lib/lodgify/sync";
import { createAdminClient } from "@/lib/supabase/admin";

function verifySignature(rawBody: string, signature: string, secrets: string[]): boolean {
  // signature format: "sha256=<hex>"
  for (const secret of secrets) {
    const computed = "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
    try {
      if (timingSafeEqual(Buffer.from(computed), Buffer.from(signature))) {
        return true;
      }
    } catch {
      // length mismatch — skip
    }
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

  // Try to parse payload upfront so we can log it even if signature check fails.
  // Lodgify sends events as an array: [{ action, booking: { id }, guest, ... }]
  type LodgifyEvent = {
    action?: string;
    event?: string;
    booking_id?: number;
    booking?: { id?: number };
  };
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

  // Verify ms-signature from Lodgify
  const signingSecrets = process.env.LODGIFY_WEBHOOK_SIGNING_SECRETS;
  const signature = request.headers.get("ms-signature") ?? "";
  log.signature_present = signature.length > 0;

  if (signingSecrets) {
    const secrets = signingSecrets.split(",").map((s) => s.trim()).filter(Boolean);
    const valid = verifySignature(rawBody, signature, secrets);
    log.signature_valid = valid;
    if (!valid) {
      log.status_code = 401;
      log.outcome = "signature_invalid";
      log.error_message = "Invalid ms-signature header";
      log.duration_ms = Date.now() - startedAt;
      console.error(`[lodgify-webhook] Invalid signature for booking ${log.lodgify_booking_id ?? "?"}`);
      await writeLog(log);
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  } else {
    // No secret configured — record so we can spot misconfig in the log
    log.signature_valid = null;
    log.error_message = "LODGIFY_WEBHOOK_SIGNING_SECRETS not set (signature not verified)";
  }

  if (!parsed) {
    log.status_code = 400;
    log.outcome = "invalid_json";
    log.error_message = log.error_message ?? "Request body is not valid JSON";
    log.duration_ms = Date.now() - startedAt;
    console.error("[lodgify-webhook] Invalid JSON body");
    await writeLog(log);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

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
    log.status_code = 500;
    log.outcome = "sync_failed";
    log.error_message = message;
    log.duration_ms = Date.now() - startedAt;
    console.error(`[lodgify-webhook] Error syncing booking ${bookingId}:`, message);
    await writeLog(log);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
