import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { syncBookingById } from "@/lib/lodgify/sync";

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

export async function POST(request: Request) {
  const rawBody = await request.text();

  // Verify ms-signature from Lodgify
  const signingSecrets = process.env.LODGIFY_WEBHOOK_SIGNING_SECRETS;
  if (signingSecrets) {
    const signature = request.headers.get("ms-signature") ?? "";
    const secrets = signingSecrets.split(",").map((s) => s.trim());
    if (!verifySignature(rawBody, signature, secrets)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let body: { action?: string; event?: string; booking_id?: number; booking?: { id?: number } };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Lodgify sends { "action": "booking_change", "booking": { "id": 123 } }
  // Also support flat { "booking_id": 123 } for manual triggers
  const bookingId = body.booking?.id ?? body.booking_id;
  if (!bookingId) {
    return NextResponse.json({ error: "Missing booking id" }, { status: 400 });
  }

  try {
    const result = await syncBookingById(bookingId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[lodgify-webhook] Error syncing booking ${bookingId}:`, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
