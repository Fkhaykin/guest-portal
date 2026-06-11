// Export all Lodgify booking message threads to JSON.
import { readFileSync, writeFileSync } from "node:fs";

const env = readFileSync("/Users/dankdesign/guest-portal/.env.local", "utf8");
const API_KEY = env.match(/^LODGIFY_API_KEY=(.+)$/m)?.[1]?.trim();
if (!API_KEY) throw new Error("LODGIFY_API_KEY not found");

const BASE = "https://api.lodgify.com";
const headers = { "X-ApiKey": API_KEY, Accept: "application/json" };

async function get(path, retries = 3) {
  for (let i = 0; i <= retries; i++) {
    const res = await fetch(BASE + path, { headers });
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
      continue;
    }
    if (!res.ok) return null;
    return res.json();
  }
  return null;
}

// 1. Properties
const props = await get("/v2/properties?includeCount=false&includeInOut=false&page=1&size=50");
const propertyMap = {};
for (const p of props?.items ?? props ?? []) propertyMap[p.id] = p.name;
console.log("Properties:", JSON.stringify(propertyMap));

// 2. All bookings (v1 paginated)
const bookings = [];
let offset = 0;
while (true) {
  const data = await get(`/v1/reservation?offset=${offset}&limit=50`);
  if (!data?.items?.length) break;
  bookings.push(...data.items);
  if (bookings.length >= data.total || data.items.length < 50) break;
  offset += 50;
}
console.log("Bookings:", bookings.length);

// 3. Per-booking thread messages, concurrency 5
const out = [];
let done = 0;
async function processBooking(b) {
  const detail = await get(`/v2/reservations/bookings/${b.id}`);
  const threadUid = detail?.thread_uid;
  let messages = [];
  if (threadUid) {
    const thread = await get(`/v2/messaging/${threadUid}`);
    messages = (thread?.messages ?? []).map((m) => ({
      type: m.type, // Owner = host, Renter = guest
      date: m.date_created ?? m.created_at ?? null,
      text: (m.message ?? "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .trim(),
    })).filter((m) => m.text);
  }
  done++;
  if (done % 25 === 0) console.log(`  ${done}/${bookings.length}`);
  if (!messages.length) return;
  out.push({
    booking_id: b.id,
    guest_name: b.guest?.name ?? null,
    property_id: b.property_id,
    property_name: propertyMap[b.property_id] ?? String(b.property_id),
    arrival: b.arrival,
    departure: b.departure,
    status: b.status,
    source: b.source,
    created: b.created_at ?? b.date_created ?? null,
    messages,
  });
}

const queue = [...bookings];
await Promise.all(
  Array.from({ length: 5 }, async () => {
    while (queue.length) await processBooking(queue.shift());
  })
);

out.sort((a, b) => (a.created ?? "").localeCompare(b.created ?? ""));
writeFileSync("/tmp/lodgify-conversations.json", JSON.stringify(out, null, 1));
const msgCount = out.reduce((n, c) => n + c.messages.length, 0);
console.log(`Wrote ${out.length} conversations, ${msgCount} messages`);
