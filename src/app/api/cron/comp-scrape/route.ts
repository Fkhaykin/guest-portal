import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  discoverPdpContext,
  fetchCompCalendar,
  jitterMs,
  pickProbeWindows,
  probeCompPrice,
} from "@/lib/comps/airbnb";
import { todayInTz } from "@/lib/pricing/engine";

export const maxDuration = 300;

const CALENDAR_HORIZON_DAYS = 365;
const PROBE_WEEKENDS = 5;
const PROBE_MIDWEEKS = 3;
const PROBE_HORIZON_DAYS = 120;
const BATCH_SIZE = 14; // comps per invocation — the rest roll to the next run/day

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// GET /api/cron/comp-scrape
// Daily cron. For each active comp listing: snapshot 365 days of availability
// + min-stay from Airbnb's calendar, then price-probe a handful of upcoming
// weekend/midweek stay windows. Nightly diffs of these snapshots become the
// market pickup/occupancy signal (and our own listings, seeded is_self=true,
// benchmark the scraper against prices we already know).
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

  const { data: comps, error } = await admin
    .from("comp_listing")
    .select("id, nickname, airbnb_id, label, is_self")
    .eq("is_active", true)
    .order("last_scraped_at", { ascending: true, nullsFirst: true })
    .limit(BATCH_SIZE);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const results: { airbnb_id: string; days: number; probes: number }[] = [];
  const errors: { airbnb_id: string; reason: string }[] = [];

  // The StaysPdpSections operation hash is site-wide; discover it from the
  // first comp's route bundle, then reuse it for the rest of the batch so each
  // subsequent comp skips the ~180KB bundle fetch (only its per-listing
  // variables template is re-read from its page).
  let sharedHash: string | undefined;

  for (const comp of comps ?? []) {
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

      await sleep(jitterMs());
      let probes = 0;
      try {
        const ctx = await discoverPdpContext(comp.airbnb_id, sharedHash);
        sharedHash = ctx.hash;
        const windows = pickProbeWindows(horizon, {
          weekends: PROBE_WEEKENDS,
          midweeks: PROBE_MIDWEEKS,
          horizonDays: PROBE_HORIZON_DAYS,
        });
        for (const w of windows) {
          await sleep(jitterMs());
          const quote = await probeCompPrice(ctx, w.checkIn, w.checkOut);
          if (!quote) continue;
          probes++;
          // Attribute the per-night accommodation rate to each covered night.
          for (let d = w.checkIn; d < w.checkOut; d = addDays(d, 1)) {
            priceByDate.set(d, quote.nightlyCents);
          }
        }
      } catch {
        // Price probing is best-effort; availability alone is still useful.
      }
      for (const row of rows) {
        const p = priceByDate.get(row.stay_date);
        if (p !== undefined) row.price_cents = p;
      }

      for (let i = 0; i < rows.length; i += 500) {
        const { error: upsertErr } = await admin
          .from("comp_snapshot")
          .upsert(rows.slice(i, i + 500), { onConflict: "comp_id,snapshot_date,stay_date" });
        if (upsertErr) throw new Error(`comp_snapshot upsert: ${upsertErr.message}`);
      }

      await admin
        .from("comp_listing")
        .update({ last_scraped_at: new Date().toISOString(), last_error: null })
        .eq("id", comp.id);

      results.push({ airbnb_id: comp.airbnb_id, days: rows.length, probes });
    } catch (err) {
      const reason = err instanceof Error ? err.message : "unknown";
      await admin
        .from("comp_listing")
        .update({ last_scraped_at: new Date().toISOString(), last_error: reason })
        .eq("id", comp.id);
      errors.push({ airbnb_id: comp.airbnb_id, reason });
    }
  }

  return NextResponse.json({ ok: errors.length === 0, snapshot_date: today, results, errors });
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
