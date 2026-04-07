import { NextResponse } from "next/server";
import { syncAllBookings } from "@/lib/lodgify/sync";

export const maxDuration = 300;

export async function POST(request: Request) {
  // Protect with a shared secret so only admins/cron can trigger
  const secret = process.env.LODGIFY_WEBHOOK_SECRET;
  if (secret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: { property_id?: number } = {};
  try {
    body = await request.json();
  } catch {
    // empty body is fine — sync everything
  }

  try {
    const result = await syncAllBookings({
      propertyId: body.property_id,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[lodgify-sync] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
