// Loads the engine's inputs from Supabase: the occupied-night set for a house
// (bookings + owner blocks across every Lodgify listing sharing the nickname)
// and the per-house pricing configs.

import { createAdminClient } from "@/lib/supabase/admin";
import { addDays, type EngineConfig, type PricingRules, DEFAULT_RULES } from "./engine";

type Admin = ReturnType<typeof createAdminClient>;

export interface PricingConfigRecord extends EngineConfig {
  id: string;
  mode: "off" | "shadow" | "live";
}

export async function loadPricingConfigs(admin: Admin): Promise<PricingConfigRecord[]> {
  const { data, error } = await admin
    .from("pricing_config")
    .select("id, nickname, mode, base_price_cents, min_price_cents, max_price_cents, rules")
    .order("nickname");
  if (error) throw new Error(`pricing_config load failed: ${error.message}`);
  return (data ?? []).map((row) => ({
    ...row,
    rules: { ...DEFAULT_RULES, ...(row.rules as Partial<PricingRules>) },
  }));
}

/** All property ids sharing the nickname (case-insensitive), active or not —
 *  a booking on either duplicate listing occupies the physical house. */
export async function nicknamePropertyIds(admin: Admin, nickname: string): Promise<string[]> {
  const { data } = await admin.from("property").select("id").ilike("nickname", nickname);
  return (data ?? []).map((p) => p.id);
}

export async function loadOccupiedNights(
  admin: Admin,
  nickname: string,
  today: string,
  horizonDays: number
): Promise<Set<string>> {
  const ids = await nicknamePropertyIds(admin, nickname);
  const nights = new Set<string>();
  if (ids.length === 0) return nights;
  const horizonEnd = addDays(today, horizonDays);

  const { data: bookings } = await admin
    .from("registration")
    .select("check_in_date, check_out_date")
    .in("property_id", ids)
    .eq("status", "active")
    .lt("check_in_date", horizonEnd)
    .gt("check_out_date", today);

  const { data: blocks } = await admin
    .from("property_block")
    .select("start_date, end_date")
    .in("property_id", ids)
    .lt("start_date", horizonEnd)
    .gt("end_date", today);

  const spans = [
    ...(bookings ?? []).map((b) => ({ from: b.check_in_date, to: b.check_out_date })),
    ...(blocks ?? []).map((b) => ({ from: b.start_date, to: b.end_date })),
  ];
  for (const span of spans) {
    // Nights are [from, to) — checkout day is not occupied.
    for (let d = span.from; d < span.to; d = addDays(d, 1)) {
      if (d >= today && d < horizonEnd) nights.add(d);
    }
  }
  return nights;
}
