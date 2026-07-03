import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { discoverCompsBulk, getListingProfile } from "@/lib/comps/discover";

export const maxDuration = 300;

// POST /api/admin/pricing-lab/comps/discover-bulk { nickname, target? }
// Auto-builds a large bedroom-matched comp set for a house: anchors on its
// is_self Airbnb listing, tile-sweeps the surrounding market, and inserts up to
// `target` new comps (with coords, beds, rating, lakefront flag). Returns how
// many were added. Idempotent — existing comps (any house) are skipped.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { nickname: string; target?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.nickname) return NextResponse.json({ error: "nickname required" }, { status: 400 });
  const target = Math.min(Math.max(body.target ?? 100, 1), 150);

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("comp_listing")
    .select("airbnb_id, is_self")
    .ilike("nickname", body.nickname);
  const anchor = (existing ?? []).find((c) => c.is_self);
  if (!anchor) {
    return NextResponse.json({ error: "No is_self anchor listing for this house" }, { status: 400 });
  }

  const { data: allComps } = await admin.from("comp_listing").select("airbnb_id");
  const exclude = new Set((allComps ?? []).map((c) => c.airbnb_id));

  let profile;
  try {
    profile = await getListingProfile(anchor.airbnb_id);
    // Keep the house anchor's lakefront flag current.
    await admin.from("comp_listing").update({ is_lakefront: profile.isLakefront }).eq("airbnb_id", anchor.airbnb_id);
  } catch (err) {
    return NextResponse.json({ error: `anchor profile failed: ${err instanceof Error ? err.message : ""}` }, { status: 502 });
  }

  const { data: current } = await admin
    .from("comp_listing")
    .select("id")
    .ilike("nickname", body.nickname)
    .eq("is_self", false);
  const room = Math.max(0, target - (current?.length ?? 0));
  if (room === 0) {
    return NextResponse.json({ added: 0, message: "Already at target", have: current?.length ?? 0 });
  }

  const candidates = await discoverCompsBulk(profile, exclude, room);
  const rows = candidates.map((c) => ({
    nickname: body.nickname,
    airbnb_id: c.airbnbId,
    label: c.name.slice(0, 60),
    url: `https://www.airbnb.com/rooms/${c.airbnbId}`,
    lat: c.lat,
    lng: c.lng,
    bedrooms: c.beds,
    rating: c.rating,
    review_count: c.reviewCount,
    is_lakefront: c.isLakefront,
    is_self: false,
  }));
  if (rows.length === 0) return NextResponse.json({ added: 0, candidates: 0 });

  const { data: inserted, error } = await admin.from("comp_listing").insert(rows).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    added: inserted?.length ?? 0,
    lakefront_anchor: profile.isLakefront,
    have: (current?.length ?? 0) + (inserted?.length ?? 0),
  });
}
