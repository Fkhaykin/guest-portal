import { NextResponse } from "next/server";
import { runEveningSends } from "@/lib/guest-messages/cron";

export const maxDuration = 300;

// GET /api/cron/guest-messages-evening
// Called by Vercel cron daily at 22:00 UTC (6pm EDT / 5pm EST) — always
// after the 4pm check-in, never before it.
// Sends the settling-in welcome on check-in evening, and the night-2 pulse
// check for longer stays where the guest has gone quiet since check-in.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const { results } = await runEveningSends();
  return NextResponse.json({ ok: true, results });
}
