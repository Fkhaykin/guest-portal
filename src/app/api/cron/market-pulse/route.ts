import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { aggregateMarketPulse } from "@/lib/pricing/market";
import { todayInTz } from "@/lib/pricing/engine";

export const maxDuration = 300;

// GET /api/cron/market-pulse
// Daily cron, after the morning comp scrapes. Collapses comp_snapshot history
// into market_pulse rows per house per stay date: occupancy, price
// percentiles, and the booking-velocity signal (pickup_1d / pickup_7d) the
// engine's velocity factor consumes. Runs before pricing-shadow so today's
// prices see today's market.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const admin = createAdminClient();
  const today = todayInTz();

  const { data: configs } = await admin.from("pricing_config").select("nickname").order("nickname");
  const results: { nickname: string; dates: number; comps: number }[] = [];
  const errors: { nickname: string; reason: string }[] = [];

  for (const cfg of configs ?? []) {
    try {
      const out = await aggregateMarketPulse(admin, cfg.nickname, today);
      results.push({ nickname: cfg.nickname, ...out });
    } catch (err) {
      errors.push({ nickname: cfg.nickname, reason: err instanceof Error ? err.message : "unknown" });
    }
  }

  return NextResponse.json({ ok: errors.length === 0, snapshot_date: today, results, errors });
}
