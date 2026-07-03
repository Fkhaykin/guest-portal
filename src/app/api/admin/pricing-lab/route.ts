import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeRates, todayInTz, DEFAULT_RULES, type PricingRules } from "@/lib/pricing/engine";
import { loadOccupiedNights } from "@/lib/pricing/data";

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

  // Comp set + latest comp snapshot aggregates (next 30 stay dates).
  const { data: comps } = await admin
    .from("comp_listing")
    .select("id, airbnb_id, label, url, is_self, is_active, last_scraped_at, last_error")
    .ilike("nickname", config.nickname)
    .order("is_self", { ascending: false })
    .order("created_at");
  const compStats: Record<string, { occupancy30: number | null; medianPriceCents: number | null }> = {};
  const today = todayInTz();
  for (const comp of comps ?? []) {
    const { data: snap } = await admin
      .from("comp_snapshot")
      .select("stay_date, available, price_cents, snapshot_date")
      .eq("comp_id", comp.id)
      .gte("stay_date", today)
      .lte("stay_date", addDaysIso(today, 30))
      .order("snapshot_date", { ascending: false })
      .limit(62);
    if (!snap?.length) {
      compStats[comp.id] = { occupancy30: null, medianPriceCents: null };
      continue;
    }
    const latest = snap.filter((s) => s.snapshot_date === snap[0].snapshot_date);
    const unavailable = latest.filter((s) => s.available === false).length;
    const prices = latest.map((s) => s.price_cents).filter((p): p is number => p !== null).sort((a, b) => a - b);
    compStats[comp.id] = {
      occupancy30: latest.length ? Math.round((unavailable / latest.length) * 100) : null,
      medianPriceCents: prices.length ? prices[Math.floor(prices.length / 2)] : null,
    };
  }

  return NextResponse.json({
    config,
    latest_snapshot_date: latestDate,
    snapshot,
    divergence,
    comps: (comps ?? []).map((c) => ({ ...c, stats: compStats[c.id] })),
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
