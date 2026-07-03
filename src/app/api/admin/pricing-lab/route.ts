import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeRates, todayInTz, DEFAULT_RULES, type PricingRules } from "@/lib/pricing/engine";
import { loadOccupiedNights } from "@/lib/pricing/data";
import {
  loadLatestPulse,
  loadVelocityByDate,
  occupancyWindow,
  computePosition,
} from "@/lib/pricing/market";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// GET /api/admin/pricing-lab?nickname=<house>
// Everything the Pricing Lab page needs for one house: config, the latest
// snapshot (ours vs PriceLabs per stay date), the day-by-day divergence
// history, and the comp set with its latest scrape aggregates.
export async function GET(request: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();

  const nickname = request.nextUrl.searchParams.get("nickname");
  const { data: configs } = await admin
    .from("pricing_config")
    .select("id, nickname, mode, base_price_cents, min_price_cents, max_price_cents, rules")
    .order("nickname");
  if (!nickname) return NextResponse.json({ configs: configs ?? [] });

  const config = (configs ?? []).find((c) => c.nickname.toLowerCase() === nickname.toLowerCase());
  if (!config) return NextResponse.json({ error: "No config for that house" }, { status: 404 });

  const { data: latestRow } = await admin
    .from("rate_snapshot")
    .select("snapshot_date")
    .ilike("nickname", config.nickname)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  const latestDate = latestRow?.snapshot_date ?? null;

  let snapshot: unknown[] = [];
  if (latestDate) {
    const { data } = await admin
      .from("rate_snapshot")
      .select(
        "stay_date, our_price_cents, our_min_stay, factors, pl_price_cents, pl_user_price_cents, pl_min_stay, is_booked"
      )
      .ilike("nickname", config.nickname)
      .eq("snapshot_date", latestDate)
      .order("stay_date");
    snapshot = data ?? [];
  }

  // Divergence history: one point per snapshot day — mean |Δ%| between our
  // price and PriceLabs' pushed price over the next 90 stay dates.
  const { data: histRows } = await admin
    .from("rate_snapshot")
    .select("snapshot_date, stay_date, our_price_cents, pl_user_price_cents")
    .ilike("nickname", config.nickname)
    .not("pl_user_price_cents", "is", null)
    .not("our_price_cents", "is", null)
    .order("snapshot_date");
  const byDay = new Map<string, { sum: number; n: number }>();
  for (const r of histRows ?? []) {
    const within90 =
      r.stay_date >= r.snapshot_date &&
      r.stay_date <= addDaysIso(r.snapshot_date as string, 90);
    if (!within90 || !r.pl_user_price_cents || !r.our_price_cents) continue;
    const diff = Math.abs(r.our_price_cents - r.pl_user_price_cents) / r.pl_user_price_cents;
    const agg = byDay.get(r.snapshot_date as string) ?? { sum: 0, n: 0 };
    agg.sum += diff;
    agg.n++;
    byDay.set(r.snapshot_date as string, agg);
  }
  const divergence = [...byDay.entries()].map(([date, { sum, n }]) => ({
    snapshot_date: date,
    mean_abs_pct: Math.round((sum / n) * 1000) / 10,
    dates_compared: n,
  }));

  // Comp set with pre-computed per-comp rollups (occupancy_30, median price).
  const today = todayInTz();
  const { data: comps } = await admin
    .from("comp_listing")
    .select(
      "id, airbnb_id, label, url, is_self, is_active, last_scraped_at, last_priced_at, last_error, lat, lng, bedrooms, rating, review_count, is_lakefront, occupancy_30, median_price_cents"
    )
    .ilike("nickname", config.nickname)
    .order("is_self", { ascending: false })
    .order("occupancy_30", { ascending: false, nullsFirst: false });
  const compStats: Record<string, { occupancy30: number | null; medianPriceCents: number | null }> = {};
  for (const comp of comps ?? []) {
    compStats[comp.id] = {
      occupancy30: comp.occupancy_30 != null ? Math.round(comp.occupancy_30 * 100) : null,
      medianPriceCents: comp.median_price_cents ?? null,
    };
  }

  // Market pulse (occupancy + price percentiles + velocity per stay date) drives
  // demand shading, the Neighborhood chart, and the Algorithm tab.
  const pulse = await loadLatestPulse(admin, config.nickname);
  const market = pulse.map((p) => ({
    stay_date: p.stay_date,
    occupancy: p.occupancy,
    compsCounted: p.comps_tracked,
    p25: p.p25_cents,
    p50: p.p50_cents,
    p75: p.p75_cents,
    p90: p.p90_cents,
    pricesCounted: p.prices_counted,
    pickup_7d: p.pickup_7d,
    pickup_1d: p.pickup_1d,
    lf_occupancy: p.lf_occupancy,
    lf_p50: p.lf_p50_cents,
  }));

  const occupied = await loadOccupiedNights(admin, config.nickname, today, 365);
  const metrics = {
    occ7: occupancyWindow(occupied, today, 7),
    occ30: occupancyWindow(occupied, today, 30),
    occ60: occupancyWindow(occupied, today, 60),
  };

  // Market position: ours vs comps over 30/60/90 + weekend/weeknight averages.
  const position = computePosition(
    (snapshot as { stay_date: string; our_price_cents: number | null; is_booked: boolean }[]),
    pulse,
    occupied,
    today
  );

  // Hot dates: highest 7-day pickup among still-open future dates.
  const velocityByDate = await loadVelocityByDate(admin, config.nickname);
  const openByDate = new Map(
    (snapshot as { stay_date: string; is_booked: boolean; our_price_cents: number | null; factors: { velocity_pct?: number } | null }[]).map(
      (r) => [r.stay_date, r]
    )
  );
  const hotDates = [...velocityByDate.entries()]
    .map(([stay_date, pickup]) => {
      const row = openByDate.get(stay_date);
      return {
        stay_date,
        pickup_7d: pickup,
        our_price_cents: row?.our_price_cents ?? null,
        velocity_pct: row?.factors?.velocity_pct ?? 0,
        booked: row?.is_booked ?? false,
      };
    })
    .filter((d) => !d.booked && d.pickup_7d > 0)
    .sort((a, b) => b.pickup_7d - a.pickup_7d)
    .slice(0, 12);

  const self = (comps ?? []).find((c) => c.is_self && c.lat != null && c.lng != null);
  const house = self ? { lat: self.lat as number, lng: self.lng as number } : null;

  return NextResponse.json({
    config,
    latest_snapshot_date: latestDate,
    snapshot,
    divergence,
    comps: (comps ?? []).map((c) => ({ ...c, stats: compStats[c.id] })),
    market,
    metrics,
    position,
    hotDates,
    house,
    today,
  });
}

// PUT /api/admin/pricing-lab — save a house's pricing config.
export async function PUT(request: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    id: string;
    mode?: string;
    base_price_cents?: number;
    min_price_cents?: number;
    max_price_cents?: number;
    rules?: Partial<PricingRules>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (body.mode && ["off", "shadow", "live"].includes(body.mode)) updates.mode = body.mode;
  for (const key of ["base_price_cents", "min_price_cents", "max_price_cents"] as const) {
    const v = body[key];
    if (typeof v === "number" && Number.isFinite(v) && v > 0) updates[key] = Math.round(v);
  }
  if (body.rules && typeof body.rules === "object") {
    updates.rules = { ...DEFAULT_RULES, ...body.rules };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("pricing_config").update(updates).eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// POST /api/admin/pricing-lab — preview: run the engine with a candidate
// config against the house's real calendar without persisting anything.
export async function POST(request: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    nickname: string;
    base_price_cents: number;
    min_price_cents: number;
    max_price_cents: number;
    rules: Partial<PricingRules>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.nickname || !body.base_price_cents) {
    return NextResponse.json({ error: "nickname and base_price_cents required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const today = todayInTz();
  const occupied = await loadOccupiedNights(admin, body.nickname, today, 365);
  const rates = computeRates(
    {
      nickname: body.nickname,
      base_price_cents: body.base_price_cents,
      min_price_cents: body.min_price_cents || Math.round(body.base_price_cents * 0.5),
      max_price_cents: body.max_price_cents || Math.round(body.base_price_cents * 2.5),
      rules: { ...DEFAULT_RULES, ...body.rules },
    },
    { today, horizonDays: 365, occupiedNights: occupied }
  );
  return NextResponse.json({ today, rates });
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
