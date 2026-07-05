import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayInTz } from "@/lib/pricing/engine";

const DAYS = 21;

// GET /api/admin/pricing-lab/comp-calendar?nickname=<house>
// Per-comp future availability + price grid (the "Competitor Calendar" under
// PriceLabs' map). Own listing pinned first; capped at ~20 comps.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const nickname = request.nextUrl.searchParams.get("nickname");
  if (!nickname) return NextResponse.json({ error: "nickname required" }, { status: 400 });

  const admin = createAdminClient();
  const today = todayInTz();
  const end = (() => {
    const d = new Date(today + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + DAYS);
    return d.toISOString().slice(0, 10);
  })();
  const dates = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(today + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });

  const { data: comps } = await admin
    .from("comp_listing")
    .select("id, label, airbnb_id, url, is_self, is_lakefront, bedrooms, occupancy_30, median_price_cents")
    .ilike("nickname", nickname)
    .eq("is_active", true)
    .order("is_self", { ascending: false })
    .order("occupancy_30", { ascending: false, nullsFirst: false })
    .limit(20);

  const rows = [];
  for (const comp of comps ?? []) {
    // Newest snapshot per comp.
    const { data: latest } = await admin
      .from("comp_snapshot")
      .select("snapshot_date")
      .eq("comp_id", comp.id)
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    const byDate: Record<string, { available: boolean | null; price: number | null }> = {};
    if (latest) {
      const { data: snaps } = await admin
        .from("comp_snapshot")
        .select("stay_date, available, price_cents")
        .eq("comp_id", comp.id)
        .eq("snapshot_date", latest.snapshot_date)
        .gte("stay_date", today)
        .lt("stay_date", end);
      for (const s of snaps ?? []) byDate[s.stay_date] = { available: s.available, price: s.price_cents };
    }
    rows.push({
      id: comp.id,
      label: comp.label || `Listing ${comp.airbnb_id}`,
      url: comp.url,
      is_self: comp.is_self,
      is_lakefront: comp.is_lakefront,
      bedrooms: comp.bedrooms,
      occupancy30: comp.occupancy_30 != null ? Math.round(comp.occupancy_30 * 100) : null,
      days: dates.map((d) => byDate[d] ?? { available: null, price: null }),
    });
  }

  return NextResponse.json({ dates, comps: rows });
}
