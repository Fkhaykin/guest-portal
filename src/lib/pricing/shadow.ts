// Shadow-phase snapshot: compute our engine's rates for a house and store them
// side-by-side with PriceLabs' rates for the same day. Shared by the daily
// cron and the Pricing Lab "Run snapshot now" action.

import { createAdminClient } from "@/lib/supabase/admin";
import { computeRates, todayInTz } from "./engine";
import { loadOccupiedNights, loadPricingConfigs, type PricingConfigRecord } from "./data";
import { loadVelocityByDate, loadDemandOccByDate } from "./market";
import { loadWeatherByDate } from "./weather";
import { getRawListingPrices, type RawListingPrice } from "@/lib/pricelabs/client";
import { getRoomTypeId } from "@/lib/lodgify/client";

type Admin = ReturnType<typeof createAdminClient>;

const HORIZON_DAYS = 365;

export interface ShadowResult {
  nickname: string;
  rows: number;
  pl: string; // which Lodgify listing supplied the PriceLabs comparison, or the error
}

export async function runShadowSnapshot(
  admin: Admin,
  onlyNickname?: string
): Promise<{ snapshot_date: string; results: ShadowResult[]; errors: { nickname: string; reason: string }[] }> {
  const today = todayInTz();
  const results: ShadowResult[] = [];
  const errors: { nickname: string; reason: string }[] = [];

  let configs = (await loadPricingConfigs(admin)).filter((c) => c.mode !== "off");
  if (onlyNickname) {
    configs = configs.filter((c) => c.nickname.toLowerCase() === onlyNickname.toLowerCase());
  }

  for (const cfg of configs) {
    try {
      results.push(await snapshotHouse(admin, cfg, today));
    } catch (err) {
      errors.push({ nickname: cfg.nickname, reason: err instanceof Error ? err.message : "unknown" });
    }
  }
  return { snapshot_date: today, results, errors };
}

async function snapshotHouse(
  admin: Admin,
  cfg: PricingConfigRecord,
  today: string
): Promise<ShadowResult> {
  const occupied = await loadOccupiedNights(admin, cfg.nickname, today, HORIZON_DAYS);
  const velocityByDate = await loadVelocityByDate(admin, cfg.nickname);
  const demandOccByDate = await loadDemandOccByDate(admin, cfg.nickname);
  const weatherPoints = await loadWeatherByDate(admin, cfg.nickname);
  const weatherByDate = new Map([...weatherPoints].map(([d, w]) => [d, w.desirability]));
  const ours = computeRates(cfg, {
    today,
    horizonDays: HORIZON_DAYS,
    occupiedNights: occupied,
    velocityByDate,
    weatherByDate,
    demandOccByDate,
  });

  // PriceLabs comparison: try each active Lodgify listing of the house until
  // one has a configured PriceLabs listing.
  const plByDate = new Map<string, RawListingPrice>();
  let plStatus = "none";
  const { data: props } = await admin
    .from("property")
    .select("lodgify_property_id")
    .ilike("nickname", cfg.nickname)
    .eq("is_active", true)
    .not("lodgify_property_id", "is", null);
  for (const prop of props ?? []) {
    try {
      const roomId = await getRoomTypeId(prop.lodgify_property_id as number);
      const raw = await getRawListingPrices(
        prop.lodgify_property_id as number,
        roomId,
        today,
        ours[ours.length - 1].date
      );
      for (const r of raw) plByDate.set(r.date.slice(0, 10), r);
      plStatus = `lodgify:${prop.lodgify_property_id}`;
      break;
    } catch (err) {
      plStatus = `error: ${err instanceof Error ? err.message.slice(0, 120) : "unknown"}`;
    }
  }

  const dollarsToCents = (v: number | null) =>
    typeof v === "number" && v > 0 ? Math.round(v * 100) : null;

  const rows = ours.map((rate) => {
    const pl = plByDate.get(rate.date);
    return {
      nickname: cfg.nickname,
      snapshot_date: today,
      stay_date: rate.date,
      our_price_cents: rate.price_cents,
      our_min_stay: rate.min_stay,
      factors: rate.factors,
      pl_price_cents: dollarsToCents(pl?.price ?? null),
      pl_user_price_cents: dollarsToCents(pl?.user_price ?? null),
      pl_min_stay: pl?.min_stay ?? null,
      is_booked: rate.factors.occupied || pl?.user_price === -1,
    };
  });

  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await admin
      .from("rate_snapshot")
      .upsert(rows.slice(i, i + 500), { onConflict: "nickname,snapshot_date,stay_date" });
    if (error) throw new Error(`snapshot upsert failed: ${error.message}`);
  }

  return { nickname: cfg.nickname, rows: rows.length, pl: plStatus };
}
