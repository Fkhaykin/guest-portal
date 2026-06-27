import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ServiceCalendar } from "@/components/calendar/service-calendar";

// Unpublished, internal-only page — keep it out of search engines.
export const metadata: Metadata = {
  title: "Service Calendar",
  robots: { index: false, follow: false },
};

// Always reflect the latest bookings.
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

type PropertyRow = {
  id: string;
  name: string;
  nickname: string | null;
  cover_image_url: string | null;
  is_active: boolean;
  sort_order: number;
};

// Resolve the 1-based house index from the query string. Accepts ?house=1,
// ?h=1, the bare ?=1 form, or any single numeric param; defaults to 1.
function parseHouseIndex(sp: SearchParams): number {
  const ordered = [sp.house, sp.h, sp[""], ...Object.values(sp)];
  for (const c of ordered) {
    const v = Array.isArray(c) ? c[0] : c;
    if (v && /^\d+$/.test(v.trim())) return parseInt(v, 10);
  }
  return 1;
}

const prettify = (s: string) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function ServiceCalendarPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const index = parseHouseIndex(sp);

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("property")
    .select("id, name, nickname, cover_image_url, is_active, sort_order")
    .order("sort_order", { ascending: true });

  const rows = (data ?? []) as PropertyRow[];
  const keyOf = (p: PropertyRow) =>
    (p.nickname || p.name || "").toLowerCase().trim();

  // Build the public house index: active houses in sort_order, grouped by
  // nickname so combined (duplicate-row) listings collapse to a single house.
  const houses: { key: string; label: string; coverImage: string | null }[] = [];
  const seen = new Set<string>();
  for (const p of rows) {
    if (!p.is_active) continue;
    const key = keyOf(p);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    houses.push({
      key,
      label: prettify(p.nickname || p.name || ""),
      coverImage: p.cover_image_url,
    });
  }

  const house = houses[index - 1];
  if (!house) notFound();

  // Combined-listing logic: a physical house may span several property rows
  // (active plus retired duplicates). Union bookings across every matching row.
  const propertyIds = rows
    .filter((p) => keyOf(p) === house.key)
    .map((p) => p.id);

  const { data: regs } = await supabase
    .from("registration")
    .select("check_in_date, check_out_date")
    .in("property_id", propertyIds)
    .in("status", ["active", "completed"])
    .gte("check_out_date", todayStr());

  // Expand each booking into its occupied nights [check-in, check-out).
  const bookedSet = new Set<string>();
  for (const r of (regs ?? []) as { check_in_date: string; check_out_date: string }[]) {
    const end = new Date(r.check_out_date + "T00:00:00");
    for (
      let d = new Date(r.check_in_date + "T00:00:00");
      d < end;
      d.setDate(d.getDate() + 1)
    ) {
      bookedSet.add(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      );
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
        <div className="relative overflow-hidden rounded-2xl aspect-video ring-1 ring-black/5 shadow-sm">
          {house.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={house.coverImage}
              alt={house.label}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-muted" />
          )}
          <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/10 to-transparent" />
          <h1 className="absolute bottom-4 left-5 text-2xl font-semibold text-white drop-shadow">
            {house.label}
          </h1>
        </div>

        <div className="mt-6">
          <ServiceCalendar bookedDates={[...bookedSet]} />
        </div>
      </div>
    </main>
  );
}
