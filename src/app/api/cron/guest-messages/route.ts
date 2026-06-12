import { NextResponse } from "next/server";
import { runMorningSends } from "@/lib/guest-messages/cron";

export const maxDuration = 300;

// GET /api/cron/guest-messages
// Called by Vercel cron daily at 12:00 UTC (~8am ET).
// Sends pre-arrival (3 days out), day-of check-in + house instructions,
// checkout-morning instructions, sentiment-gated post-checkout review
// requests, and registration reminders. All booking sources included —
// Lodgify-side auto-messages are turned off.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const { results, reminders } = await runMorningSends();
  return NextResponse.json({ ok: true, results, reminders });
}
