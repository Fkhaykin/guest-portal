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

export interface BookingNight {
  adr_cents: number | null; // nightly rent (total_amount_cents / nights)
  is_check_in: boolean;
  source: string | null;
  check_in: string;
  check_out: string;
}
export interface BlockNight {
  reason: string | null;
}

/** Per-stay-date booking + block detail for the calendar (ADR on booked
 *  nights, check-in markers, block reasons). Distinct from loadOccupiedNights,
 *  which only needs the occupied set for the engine. */
export async function loadOccupancyDetail(
  admin: Admin,
  nickname: string,
  today: string,
  horizonDays: number
): Promise<{ bookings: Record<string, BookingNight>; blocks: Record<string, BlockNight> }> {
  const ids = await nicknamePropertyIds(admin, nickname);
  const bookings: Record<string, BookingNight> = {};
  const blocks: Record<string, BlockNight> = {};
  if (ids.length === 0) return { bookings, blocks };
  const horizonEnd = addDays(today, horizonDays);

  const { data: regs } = await admin
    .from("registration")
    .select("check_in_date, check_out_date, total_amount_cents, booking_source")
    .in("property_id", ids)
    .eq("status", "active")
    .lt("check_in_date", horizonEnd)
    .gt("check_out_date", today);

  for (const b of regs ?? []) {
    const nights = Math.max(
      1,
      Math.round(
        (new Date(b.check_out_date + "T00:00:00Z").getTime() -
          new Date(b.check_in_date + "T00:00:00Z").getTime()) /
          86_400_000
      )
    );
    const adr = b.total_amount_cents ? Math.round(b.total_amount_cents / nights) : null;
    for (let d = b.check_in_date; d < b.check_out_date; d = addDays(d, 1)) {
      if (d < today || d >= horizonEnd) continue;
      bookings[d] = {
        adr_cents: adr,
        is_check_in: d === b.check_in_date,
        source: b.booking_source,
        check_in: b.check_in_date,
        check_out: b.check_out_date,
      };
    }
  }

  const { data: blk } = await admin
    .from("property_block")
    .select("start_date, end_date, reason")
    .in("property_id", ids)
    .lt("start_date", horizonEnd)
    .gt("end_date", today);
  for (const b of blk ?? []) {
    for (let d = b.start_date; d < b.end_date; d = addDays(d, 1)) {
      if (d < today || d >= horizonEnd) continue;
      if (!bookings[d]) blocks[d] = { reason: b.reason };
    }
  }

  return { bookings, blocks };
}
