import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeRates, todayInTz, DEFAULT_RULES, type PricingRules } from "@/lib/pricing/engine";
import { loadOccupiedNights, loadOccupancyDetail } from "@/lib/pricing/data";
import {
  loadLatestPulse,
  loadVelocityByDate,
  loadPublishedPrices,
  occupancyWindow,
  computePosition,
} from "@/lib/pricing/market";
import { loadWeatherByDate } from "@/lib/pricing/weather";

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
    .select("snapshot_date, created_at")
    .ilike("nickname", config.nickname)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  const latestDate = latestRow?.snapshot_date ?? null;

  // Header metadata: the active property row for this house.
  const { data: prop } = await admin
    .from("property")
    .select("name, address, max_guests, lodgify_property_id, lodgify_last_synced_at, timezone")
    .ilike("nickname", config.nickname)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

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

  // Divergence history: mean |Δ%| between our price and PriceLabs' pushed price
  // over the next 90 stay dates, per snapshot day. Aggregated in SQL so it isn't
  // capped by PostgREST's 1000-row ceiling (which silently froze the JS version
  // once rate_snapshot grew past a few days).
  const { data: divergenceRows } = await admin.rpc("divergence_history", {
    p_nickname: config.nickname,
  });
  const divergence = ((divergenceRows ?? []) as {
    snapshot_date: string;
    mean_abs_pct: number;
    dates_compared: number;
  }[])
    .slice()
    .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));

  // Comp set with pre-computed per-comp rollups (occupancy_30, median price).
  const today = todayInTz();
  const { data: comps } = await admin
    .from("comp_listing")
    .select(
      "id, airbnb_id, label, url, is_self, is_active, last_scraped_at, last_priced_at, last_error, lat, lng, bedrooms, bathrooms, rating, review_count, is_lakefront, has_hot_tub, has_sauna, has_game_room, occupancy_30, occupancy_60, occupancy_90, median_price_cents, median_weekend_cents, median_weeknight_cents"
    )
    .ilike("nickname", config.nickname)
    .order("is_self", { ascending: false })
    .order("occupancy_30", { ascending: false, nullsFirst: false });
  const pct = (v: number | null | undefined) => (v != null ? Math.round(v * 100) : null);
  const compStats: Record<
    string,
    {
      occupancy30: number | null;
      occupancy60: number | null;
      occupancy90: number | null;
      medianPriceCents: number | null;
      medianWeekendCents: number | null;
      medianWeeknightCents: number | null;
    }
  > = {};
  for (const comp of comps ?? []) {
    compStats[comp.id] = {
      occupancy30: pct(comp.occupancy_30),
      occupancy60: pct(comp.occupancy_60),
      occupancy90: pct(comp.occupancy_90),
      medianPriceCents: comp.median_price_cents ?? null,
      medianWeekendCents: comp.median_weekend_cents ?? null,
      medianWeeknightCents: comp.median_weeknight_cents ?? null,
    };
  }

  // Market pulse (occupancy + price percentiles + velocity per stay date) drives
  // demand shading, the Neighborhood chart, and the Algorithm tab.
  const pulse = await loadLatestPulse(admin, config.nickname);
  const published = await loadPublishedPrices(admin, config.nickname, today);
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
    published_cents: published.get(p.stay_date) ?? null,
  }));

  const occupied = await loadOccupiedNights(admin, config.nickname, today, 365);
  const metrics = {
    occ7: occupancyWindow(occupied, today, 7),
    occ30: occupancyWindow(occupied, today, 30),
    occ60: occupancyWindow(occupied, today, 60),
  };
  const { bookings, blocks } = await loadOccupancyDetail(admin, config.nickname, today, 365);

  // Trailing-12-month realized ADR (mean nightly rent across past stays) — an
  // input to the "Help Me Choose a Base Price" tool.
  const yearAgo = new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10);
  const { data: propRows } = await admin
    .from("property")
    .select("id")
    .ilike("nickname", config.nickname);
  const propIds = (propRows ?? []).map((p) => p.id);
  let realizedAdr: number | null = null;
  if (propIds.length) {
    const { data: pastStays } = await admin
      .from("registration")
      .select("check_in_date, check_out_date, total_amount_cents")
      .in("property_id", propIds)
      .in("status", ["active", "completed"])
      .not("total_amount_cents", "is", null)
      .gte("check_in_date", yearAgo)
      .lt("check_in_date", today);
    const adrs: number[] = [];
    for (const s of pastStays ?? []) {
      const n = Math.round(
        (new Date(s.check_out_date + "T00:00:00Z").getTime() -
          new Date(s.check_in_date + "T00:00:00Z").getTime()) /
          86_400_000
      );
      if (n > 0 && s.total_amount_cents) adrs.push(s.total_amount_cents / n);
    }
    if (adrs.length) realizedAdr = Math.round(adrs.reduce((a, b) => a + b, 0) / adrs.length);
  }

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

  // Right-rail logs + notes.
  const { data: logs } = await admin
    .from("pricing_config_log")
    .select("id, field, old_value, new_value, created_at")
    .ilike("nickname", config.nickname)
    .order("created_at", { ascending: false })
    .limit(40);
  const { data: notes } = await admin
    .from("pricing_note")
    .select("id, body, created_at")
    .ilike("nickname", config.nickname)
    .order("created_at", { ascending: false })
    .limit(30);
  // Pricing runs: recent snapshot days with row counts + PriceLabs coverage.
  const { data: runRows } = await admin
    .from("rate_snapshot")
    .select("snapshot_date, pl_user_price_cents")
    .ilike("nickname", config.nickname)
    .order("snapshot_date", { ascending: false })
    .limit(4000);
  const runAgg = new Map<string, { rows: number; pl: number }>();
  for (const r of runRows ?? []) {
    const a = runAgg.get(r.snapshot_date as string) ?? { rows: 0, pl: 0 };
    a.rows++;
    if (r.pl_user_price_cents != null) a.pl++;
    runAgg.set(r.snapshot_date as string, a);
  }
  const pricingRuns = [...runAgg.entries()]
    .map(([date, a]) => ({ snapshot_date: date, rows: a.rows, pl_covered: a.pl }))
    .sort((x, y) => y.snapshot_date.localeCompare(x.snapshot_date))
    .slice(0, 14);

  // Weather forecast per stay date (near-term), for the calendar display.
  const weatherMap = await loadWeatherByDate(admin, config.nickname);
  const weather = Object.fromEntries(weatherMap);

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
    bookings,
    blocks,
    house,
    today,
    meta: prop
      ? {
          name: prop.name,
          address: prop.address,
          maxGuests: prop.max_guests,
          lodgifyId: prop.lodgify_property_id,
        }
      : null,
    latest_snapshot_at: latestRow?.created_at ?? null,
    pulse_date: pulse[0]?.snapshot_date ?? null,
    realizedAdr,
    logs: logs ?? [],
    notes: notes ?? [],
    pricingRuns,
    weather,
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

  // Snapshot the prior values so we can log what changed (Base Price History /
  // Action Logs in the right rail).
  const { data: before } = await admin
    .from("pricing_config")
    .select("nickname, mode, base_price_cents, min_price_cents, max_price_cents, rules")
    .eq("id", body.id)
    .maybeSingle();

  const { error } = await admin.from("pricing_config").update(updates).eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (before) {
    const changedBy = (await (await createClient()).auth.getUser()).data.user?.id ?? null;
    const rows: {
      nickname: string;
      field: string;
      old_value: string | null;
      new_value: string | null;
      changed_by: string | null;
    }[] = [];
    const fmt = (v: unknown) => (v == null ? null : typeof v === "object" ? JSON.stringify(v) : String(v));
    for (const key of ["mode", "base_price_cents", "min_price_cents", "max_price_cents"] as const) {
      if (updates[key] !== undefined && updates[key] !== (before as Record<string, unknown>)[key]) {
        rows.push({ nickname: before.nickname, field: key, old_value: fmt((before as Record<string, unknown>)[key]), new_value: fmt(updates[key]), changed_by: changedBy });
      }
    }
    if (updates.rules !== undefined && JSON.stringify(updates.rules) !== JSON.stringify(before.rules)) {
      rows.push({ nickname: before.nickname, field: "rules", old_value: null, new_value: "updated", changed_by: changedBy });
    }
    if (rows.length) await admin.from("pricing_config_log").insert(rows);
  }

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

