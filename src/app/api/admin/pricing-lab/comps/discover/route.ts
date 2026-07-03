import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { discoverComps, getListingProfile } from "@/lib/comps/discover";

export const maxDuration = 60;

// POST /api/admin/pricing-lab/comps/discover — find comp candidates for a
// house the way PriceLabs builds comp sets: anchor on the house's own Airbnb
// listing (an is_self comp), search bedroom-matched listings within ~8–15 km,
// rank nearest-neighbor style, and return suggestions (existing comps and our
// own listings excluded).
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { nickname: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.nickname) return NextResponse.json({ error: "nickname required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: comps } = await admin
    .from("comp_listing")
    .select("airbnb_id, is_self")
    .ilike("nickname", body.nickname);

  const anchor = (comps ?? []).find((c) => c.is_self);
  if (!anchor) {
    return NextResponse.json(
      { error: "No is_self Airbnb listing for this house to anchor discovery on" },
      { status: 400 }
    );
  }

  // Exclude everything already tracked for ANY house, plus every self listing —
  // a sibling house is not a market comp.
  const { data: allComps } = await admin.from("comp_listing").select("airbnb_id");
  const exclude = new Set((allComps ?? []).map((c) => c.airbnb_id));

  try {
    const profile = await getListingProfile(anchor.airbnb_id);
    const candidates = await discoverComps(profile, exclude);
    return NextResponse.json({
      anchor: { airbnb_id: anchor.airbnb_id, ...profile },
      candidates,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "discovery failed" },
      { status: 502 }
    );
  }
}
