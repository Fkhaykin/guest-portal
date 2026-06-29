import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ServiceCalendar } from "@/components/calendar/service-calendar";
import { HouseSwitcher } from "@/components/calendar/house-switcher";
import { STANDARD_CHECKIN_TIME, STANDARD_CHECKOUT_TIME } from "@/lib/upsells/timing";

// Curated exterior shots (the stored cover images are mostly interiors), keyed
// by house key. Houses absent here fall back to their cover image.
const STORAGE_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/property-images`;
const EXTERIOR_PHOTOS: Record<string, string> = {
  lakehouse: `${STORAGE_BASE}/lodgify-355872/exterior.jpg`,
  manor: `${STORAGE_BASE}/lodgify-355871/exterior.jpg`,
  "mansion/bml": `${STORAGE_BASE}/lodgify-368901/exterior.jpg`,
  "bianca's": `${STORAGE_BASE}/lodgify-368827/exterior.jpg`,
};

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
  address: string | null;
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

// Addresses are stored street-name-first ("Lakeside Drive, 484, East
// Stroudsburg, Pennsylvania, 18301"). Reorder to a clean street line plus a
// locality line. Falls back to the raw string if it doesn't parse.
function formatAddress(address: string | null): { line1: string; line2: string | null } | null {
  if (!address) return null;
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  let street = parts[0];
  let rest = parts.slice(1);
  // Leading "Street, Number" → "Number Street".
  if (parts.length > 1 && /^\d+$/.test(parts[1])) {
    street = `${parts[1]} ${parts[0]}`;
    rest = parts.slice(2);
  }
  return { line1: street, line2: rest.length ? rest.join(", ") : null };
}

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
    .select("id, name, nickname, address, cover_image_url, is_active, sort_order")
    .order("sort_order", { ascending: true });

  const rows = (data ?? []) as PropertyRow[];
  const keyOf = (p: PropertyRow) =>
    (p.nickname || p.name || "").toLowerCase().trim();

  // Build the public house index: active houses in sort_order, grouped by
  // nickname so combined (duplicate-row) listings collapse to a single house.
  const houses: {
    key: string;
    label: string;
    address: string | null;
    coverImage: string | null;
  }[] = [];
  const seen = new Set<string>();
  for (const p of rows) {
    if (!p.is_active) continue;
    const key = keyOf(p);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    houses.push({
      key,
      label: prettify(p.nickname || p.name || ""),
      address: p.address,
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

  // Expand each booking into its occupied nights [check-in, check-out), and
  // track arrival/departure days for the tap-a-date detail.
  const bookedSet = new Set<string>();
  const checkInSet = new Set<string>();
  const checkOutSet = new Set<string>();
  for (const r of (regs ?? []) as { check_in_date: string; check_out_date: string }[]) {
    checkInSet.add(r.check_in_date);
    checkOutSet.add(r.check_out_date);
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

  const address = formatAddress(house.address);
  const photo = EXTERIOR_PHOTOS[house.key] ?? house.coverImage;

  // Dropdown options — label each house by its street address (nickname fallback).
  const houseOptions = houses.map((h, i) => ({
    index: i + 1,
    label: formatAddress(h.address)?.line1 ?? h.label,
  }));

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
        <div className="relative overflow-hidden rounded-2xl h-28 sm:h-32 ring-1 ring-black/5 shadow-sm">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              alt={address?.line1 ?? house.label}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-muted" />
          )}
          <div className="absolute inset-0 bg-linear-to-t from-black/75 via-black/20 to-transparent" />
          <div className="absolute bottom-3 left-5 right-5 text-white drop-shadow">
            <h1 className="text-xl font-semibold leading-tight">
              {address?.line1 ?? house.label}
            </h1>
            {address?.line2 && (
              <p className="text-xs text-white/85 mt-0.5">{address.line2}</p>
            )}
          </div>
        </div>

        <div className="mt-6">
          <ServiceCalendar
            bookedDates={[...bookedSet]}
            checkInDates={[...checkInSet]}
            checkOutDates={[...checkOutSet]}
            checkInTime={STANDARD_CHECKIN_TIME}
            checkOutTime={STANDARD_CHECKOUT_TIME}
          />
        </div>

        <div className="mt-6">
          <HouseSwitcher houses={houseOptions} current={index} />
        </div>
      </div>
    </main>
  );
}
