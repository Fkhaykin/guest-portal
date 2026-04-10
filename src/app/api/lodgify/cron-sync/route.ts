import { NextResponse } from "next/server";
import { syncBookingsBatch } from "@/lib/lodgify/sync";

export const maxDuration = 300;

// GET /api/lodgify/cron-sync
// Called by Vercel cron to sync all Lodgify bookings.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let totalSynced = 0;
  let totalSkipped = 0;
  let offset = 0;
  let total = 0;

  while (true) {
    const result = await syncBookingsBatch({ offset });
    total = result.total;
    totalSynced += result.synced;
    totalSkipped += result.skipped;

    if (result.done || result.next_offset === null) break;
    offset = result.next_offset;
  }

  return NextResponse.json({
    ok: true,
    total,
    synced: totalSynced,
    skipped: totalSkipped,
  });
}
