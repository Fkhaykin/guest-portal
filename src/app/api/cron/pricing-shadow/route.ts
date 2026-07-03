import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runShadowSnapshot } from "@/lib/pricing/shadow";

export const maxDuration = 300;

// GET /api/cron/pricing-shadow
// Daily cron (shadow phase of the in-house pricing engine). For every house
// with a pricing_config not in 'off' mode: compute our price + min-stay for
// the next 365 nights, fetch what PriceLabs computed/pushed for the same
// nights, and store both side-by-side in rate_snapshot for the Pricing Lab
// UI. Nothing is pushed to Lodgify.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const admin = createAdminClient();
  try {
    const outcome = await runShadowSnapshot(admin);
    return NextResponse.json({ ok: outcome.errors.length === 0, ...outcome });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}
