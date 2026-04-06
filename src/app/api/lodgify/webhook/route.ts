import { NextResponse } from "next/server";
import { syncBookingById } from "@/lib/lodgify/sync";

export async function POST(request: Request) {
  // Verify webhook secret if configured
  const secret = process.env.LODGIFY_WEBHOOK_SECRET;
  if (secret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: { event?: string; booking_id?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const bookingId = body.booking_id;
  if (!bookingId) {
    return NextResponse.json({ error: "Missing booking_id" }, { status: 400 });
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
