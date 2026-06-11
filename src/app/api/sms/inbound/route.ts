import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isRegistrationId,
  recordDirectMessage,
} from "@/lib/guest-messages/direct";
import { notifyHostOfGuestMessage } from "@/lib/push/notify-host";

// Textbelt reply webhook: guests replying to direct-booking SMS land here.
// We pass the registration id as webhookData when sending, so it comes back
// in the payload's `data` field. Signature: HMAC-SHA256 of timestamp+payload
// keyed by the Textbelt API key.

function verifySignature(request: NextRequest, payload: string): boolean {
  const key = process.env.TEXTBELT_API_KEY?.trim();
  if (!key) return false;
  const timestamp = request.headers.get("x-textbelt-timestamp") ?? "";
  const signature = request.headers.get("x-textbelt-signature") ?? "";
  if (!timestamp || !signature) return false;
  // Reject stale timestamps (>15 min) to block replays.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 15 * 60) return false;
  const expected = crypto
    .createHmac("sha256", key)
    .update(timestamp + payload)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature)
    );
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const payload = await request.text();

  if (!verifySignature(request, payload)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: { fromNumber?: string; text?: string; data?: string };
  try {
    body = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = body.text?.trim();
  if (!text) return NextResponse.json({ ignored: true });

  const admin = createAdminClient();

  // Primary: registration id we attached as webhookData on send.
  let registrationId =
    body.data && isRegistrationId(body.data) ? body.data : null;

  // Fallback: match the sender's phone to a guest's latest direct booking.
  if (!registrationId && body.fromNumber) {
    const digits = body.fromNumber.replace(/\D/g, "").slice(-10);
    if (digits.length === 10) {
      // Phone formats vary ("(555) 123-4567", "+15551234567") — narrow by the
      // last 4 digits, then compare normalized.
      const { data: guests } = await admin
        .from("guest")
        .select("id, phone")
        .like("phone", `%${digits.slice(-4)}%`);
      const guest = (guests ?? []).find(
        (g) => (g.phone ?? "").replace(/\D/g, "").endsWith(digits)
      );
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
  }

  if (!registrationId) {
    console.warn("[sms-inbound] Could not resolve registration for", body.fromNumber);
    return NextResponse.json({ ignored: true });
  }

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
    channel: "sms",
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
    console.error("[sms-inbound] Host push failed:", err);
  });

  return NextResponse.json({ success: true });
}
