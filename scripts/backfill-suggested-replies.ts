// One-off backfill: generate AI-suggested replies for every conversation where
// the guest spoke last within the past N days, and store them in message_draft
// so the admin messenger prepopulates instantly.
//
// Run: npx tsx scripts/backfill-suggested-replies.ts [days]
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Load .env.local before importing anything that reads process.env
const envFile = readFileSync(resolve(__dirname, "../.env.local"), "utf8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

import { createClient } from "@supabase/supabase-js";
import {
  generateDraftReply,
  hashGuestMessage,
  lastUnansweredGuestMessage,
  type DraftMessage,
} from "../src/lib/guest-messages/suggest";

const LODGIFY_BASE = "https://api.lodgify.com";
const DAYS = Number(process.argv[2] ?? 30);

const lodgifyHeaders = {
  "X-ApiKey": process.env.LODGIFY_API_KEY!,
  Accept: "application/json",
};

async function lodgify(path: string): Promise<Record<string, unknown> | null> {
  for (let i = 0; i < 3; i++) {
    const res = await fetch(LODGIFY_BASE + path, { headers: lodgifyHeaders });
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
      continue;
    }
    if (!res.ok) return null;
    return res.json();
  }
  return null;
}

interface Booking {
  id: number;
  guest: { name: string | null };
  property_id: number;
  arrival: string | null;
  departure: string | null;
  status: string;
  created_at?: string | null;
  date_created?: string | null;
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const cutoff = new Date(Date.now() - DAYS * 86400_000).toISOString();
  const windowStart = new Date(Date.now() - (DAYS + 5) * 86400_000).toISOString().slice(0, 10);

  // Property names
  const props = (await lodgify("/v2/properties?page=1&size=50")) as { items?: { id: number; name: string }[] } | null;
  const propertyMap: Record<number, string> = {};
  for (const p of props?.items ?? []) propertyMap[p.id] = p.name;

  // Candidate bookings: stay or creation near the window
  const bookings: Booking[] = [];
  let offset = 0;
  while (true) {
    const data = (await lodgify(`/v1/reservation?offset=${offset}&limit=50`)) as
      | { items: Booking[]; total: number }
      | null;
    if (!data?.items?.length) break;
    bookings.push(...data.items);
    offset += 50;
    if (offset >= data.total || data.items.length < 50) break;
  }

  const candidates = bookings.filter((b) => {
    const created = (b.created_at ?? b.date_created ?? "").slice(0, 10);
    return (b.departure && b.departure >= windowStart) || (created && created >= windowStart);
  });
  console.log(`Bookings: ${bookings.length}, candidates in window: ${candidates.length}`);

  let unanswered = 0,
    drafted = 0,
    cachedHits = 0,
    failed = 0;

  for (const b of candidates) {
    const detail = await lodgify(`/v2/reservations/bookings/${b.id}`);
    const threadUid = detail?.thread_uid as string | undefined;
    if (!threadUid) continue;

    const thread = (await lodgify(`/v2/messaging/${threadUid}`)) as {
      messages?: { type: string; message?: string; date_created?: string }[];
    } | null;
    const raw = thread?.messages ?? [];
    if (!raw.length) continue;

    const messages: (DraftMessage & { date: string })[] = raw
      .map((m) => ({
        type: m.type ?? "Comment",
        text: (m.message ?? "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").trim(),
        date: m.date_created ?? "",
      }))
      .filter((m) => m.text);

    const lastGuest = lastUnansweredGuestMessage(messages);
    if (!lastGuest) continue;

    // Only messages within the window count as "unanswered in the last N days"
    const lastMsg = [...messages].reverse().find((m) => m.type.toLowerCase() !== "comment");
    if (!lastMsg?.date || lastMsg.date < cutoff) continue;

    unanswered++;
    const hash = hashGuestMessage(lastGuest);

    const { data: cached } = await supabase
      .from("message_draft")
      .select("last_guest_message_hash")
      .eq("lodgify_booking_id", b.id)
      .maybeSingle();
    if (cached?.last_guest_message_hash === hash) {
      cachedHits++;
      continue;
    }

    try {
      const draft = await generateDraftReply({
        guestName: b.guest?.name ?? null,
        propertyName: propertyMap[b.property_id] ?? null,
        arrival: b.arrival,
        departure: b.departure,
        status: b.status,
        messages,
      });
      if (!draft) {
        failed++;
        continue;
      }
      await supabase.from("message_draft").upsert(
        {
          lodgify_booking_id: b.id,
          draft,
          last_guest_message_hash: hash,
          generated_at: new Date().toISOString(),
        },
        { onConflict: "lodgify_booking_id" }
      );
      drafted++;
      console.log(`✓ ${b.guest?.name ?? b.id} (${propertyMap[b.property_id]?.slice(0, 30) ?? "?"}): "${draft.slice(0, 70).replace(/\n/g, " ")}..."`);
    } catch (err) {
      failed++;
      console.error(`✗ ${b.id}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`\nDone. Unanswered in last ${DAYS} days: ${unanswered}, drafted: ${drafted}, already cached: ${cachedHits}, failed: ${failed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
