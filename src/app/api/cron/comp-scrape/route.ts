import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  discoverPdpContext,
  fetchCompCalendar,
  fetchListingDetails,
  jitterMs,
  pickProbeWindows,
  probeCompPrice,
} from "@/lib/comps/airbnb";
import { todayInTz } from "@/lib/pricing/engine";

export const maxDuration = 300;

const CALENDAR_HORIZON_DAYS = 365;
const PROBE_HORIZON_DAYS = 180; // price-probe out to the pulse/chart horizon

// With hundreds of comps, one invocation can't scrape everyone. Each run:
//  - refreshes AVAILABILITY (one cheap calendar call) for a batch, oldest first
//  - PRICE-PROBES only the comps whose prices are most stale (rotated). Each
//    priced comp now tiles the whole horizon (~2 windows/week, ≈50 probes) so a
//    real percentile band can form per night — so we price FEWER comps per run
//    than we scrape for availability, and rely on rotation across the day's cron
//    runs to refresh the price-tracked set. market_pulse reads each comp's
//    latest priced snapshot, so a comp priced a day ago still feeds the bands.
// Concurrency keeps each run inside the 300s budget.
const AVAIL_BATCH = 60;
const PRICE_BATCH = 12;
const CONCURRENCY = 6;
// Amenity/bathroom detail is static — scrape it once per comp (an extra PDP
// fetch), a bounded number per run, self-healing across the day's rotation.
const ENRICH_BATCH = 20;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function mapPool<T, R>(items: T[], n: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let idx = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      for (;;) {
        const i = idx++;
        if (i >= items.length) break;
        out[i] = await fn(items[i], i);
      }
    })
  );
  return out;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const admin = createAdminClient();
  const today = todayInTz();

  // Availability batch: oldest-scraped comps first.
  const { data: availComps, error } = await admin
    .from("comp_listing")
    .select("id, nickname, airbnb_id, has_hot_tub")
    .eq("is_active", true)
    .order("last_scraped_at", { ascending: true, nullsFirst: true })
    .limit(AVAIL_BATCH);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // Price batch: comps whose prices are most stale (subset of availability set,
  // by last_priced_at).
  const { data: priceComps } = await admin
    .from("comp_listing")
    .select("id")
    .eq("is_active", true)
    .order("last_priced_at", { ascending: true, nullsFirst: true })
    .limit(PRICE_BATCH);
  const priceSet = new Set((priceComps ?? []).map((c) => c.id));

  // The StaysPdpSections operation hash is site-wide; discover once, reuse.
  let sharedHash: string | undefined;
  let scraped = 0;
  let priced = 0;
  let enriched = 0;
  const errors: { airbnb_id: string; reason: string }[] = [];

  await mapPool(availComps ?? [], CONCURRENCY, async (comp) => {
    try {
      const days = await fetchCompCalendar(comp.airbnb_id);
      const horizon = days.slice(0, CALENDAR_HORIZON_DAYS);
      const rows = horizon.map((d) => ({
        comp_id: comp.id,
        snapshot_date: today,
        stay_date: d.date,
        available: d.available,
        min_nights: d.minNights,
        price_cents: null as number | null,
      }));
      const priceByDate = new Map<string, number>();

      if (priceSet.has(comp.id)) {
        await sleep(jitterMs());
        try {
          const ctx = await discoverPdpContext(comp.airbnb_id, sharedHash);
          sharedHash = ctx.hash;
          const windows = pickProbeWindows(horizon, { horizonDays: PROBE_HORIZON_DAYS });
          for (const w of windows) {
            await sleep(jitterMs(250, 700));
            const quote = await probeCompPrice(ctx, w.checkIn, w.checkOut);
            if (!quote) continue;
            for (let d = w.checkIn; d < w.checkOut; d = addDays(d, 1)) priceByDate.set(d, quote.nightlyCents);
          }
        } catch {
          // availability alone is still useful
        }
        for (const row of rows) {
          const p = priceByDate.get(row.stay_date);
          if (p !== undefined) row.price_cents = p;
        }
      }

      for (let i = 0; i < rows.length; i += 500) {
        const { error: upErr } = await admin
          .from("comp_snapshot")
          .upsert(rows.slice(i, i + 500), { onConflict: "comp_id,snapshot_date,stay_date" });
        if (upErr) throw new Error(`comp_snapshot upsert: ${upErr.message}`);
      }

      // Per-comp occupancy rollups for the comps list: fraction of the next
      // N nights that are unavailable, for the 30/60/90-day windows.
      const occFor = (win: number): number | null => {
        const nights = rows.filter((r) => r.stay_date >= today && r.stay_date <= addDays(today, win));
        const unavail = nights.filter((r) => r.available === false).length;
        const withAvail = nights.filter((r) => r.available !== null).length;
        return withAvail ? unavail / withAvail : null;
      };
      const probed = [...priceByDate.values()].sort((a, b) => a - b);
      const update: Record<string, unknown> = {
        last_scraped_at: new Date().toISOString(),
        last_error: null,
        occupancy_30: occFor(30),
        occupancy_60: occFor(60),
        occupancy_90: occFor(90),
      };
      if (priceSet.has(comp.id)) {
        update.last_priced_at = new Date().toISOString();
        if (probed.length) update.median_price_cents = probed[Math.floor(probed.length / 2)];
        priced++;
      }
      // One-time amenity/bathroom enrichment (static detail), bounded per run.
      if (comp.has_hot_tub == null && enriched < ENRICH_BATCH) {
        enriched++;
        try {
          await sleep(jitterMs(200, 600));
          const det = await fetchListingDetails(comp.airbnb_id);
          update.bathrooms = det.bathrooms;
          update.has_hot_tub = det.hasHotTub;
          update.has_sauna = det.hasSauna;
          update.has_game_room = det.hasGameRoom;
        } catch {
          // leave un-enriched; a later run retries
        }
      }
      await admin.from("comp_listing").update(update).eq("id", comp.id);
      scraped++;
    } catch (err) {
      const reason = err instanceof Error ? err.message : "unknown";
      await admin
        .from("comp_listing")
        .update({ last_scraped_at: new Date().toISOString(), last_error: reason })
        .eq("id", comp.id);
      errors.push({ airbnb_id: comp.airbnb_id, reason });
    }
  });

  return NextResponse.json({ ok: errors.length === 0, snapshot_date: today, scraped, priced, enriched, errors });
}
