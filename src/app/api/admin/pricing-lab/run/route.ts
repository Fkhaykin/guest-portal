import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runShadowSnapshot } from "@/lib/pricing/shadow";

export const maxDuration = 300;

// POST /api/admin/pricing-lab/run — run a shadow snapshot immediately (all
// houses, or one via {nickname}) instead of waiting for the daily cron.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let nickname: string | undefined;
  try {
    const body = await request.json();
    if (body && typeof body.nickname === "string") nickname = body.nickname;
  } catch {
    // no body → all houses
  }

  const admin = createAdminClient();
  try {
    const outcome = await runShadowSnapshot(admin, nickname);
    return NextResponse.json({ ok: outcome.errors.length === 0, ...outcome });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}
