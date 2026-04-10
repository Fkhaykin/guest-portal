import { NextResponse } from "next/server";
import { syncBookingsBatch } from "@/lib/lodgify/sync";

export const maxDuration = 300;

export async function POST(request: Request) {
  // Protect with CRON_SECRET so only admins/cron can trigger
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: { property_id?: number; offset?: number } = {};
  try {
    body = await request.json();
  } catch {
    // empty body is fine — sync from the beginning
  }

  try {
    const result = await syncBookingsBatch({
      propertyId: body.property_id,
      offset: body.offset,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[lodgify-sync] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
