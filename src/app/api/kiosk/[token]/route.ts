import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { nicknamePropertyIds } from "@/lib/pricing/data";
import { todayInTz } from "@/lib/pricing/engine";
import { firstNameOf } from "@/lib/guest-messages/templates";
import { effectiveStayTimes } from "@/lib/upsells/timing";
import { getCleanPhotos } from "@/lib/airbnb-photos";
import { loadWeatherByDate, fetchForecast, describeCode } from "@/lib/pricing/weather";
import {
  buildGuestSessionPayload,
  registrationSessionSelect,
} from "@/lib/guest-session-payload";
import { resolveKioskAccess, KIOSK_FALLBACK_COORDS } from "@/lib/kiosk";
import { countPublishedHousePhotos } from "@/lib/guest-photos";

const MAX_PHOTOS = 12;
const WEATHER_DAYS = 5;
// How many future stays the cleaner-screen calendar widget lists.
const UPCOMING_LIMIT = 5;

type KioskState = "arrival_day" | "mid_stay" | "checkout_day" | "none";

interface KioskUpcoming {
  check_in_date: string;
  check_out_date: string;
  check_in_time: string;
  check_out_time: string;
  has_early_checkin: boolean;
  has_late_checkout: boolean;
  first_name: string | null;
  num_guests: number | null;
  pets: number;
}

type RegRow = Record<string, unknown> & {
  check_in_date: string;
  check_out_date: string;
  property: { id: string; slug: string } | null;
};

interface KioskWeatherDay {
  date: string;
  tempMaxF: number | null;
  precipProb: number | null;
  label: string;
  emoji: string;
}

function localMinutesInTz(tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type: string) => parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);
  return get("hour") * 60 + get("minute");
}

// "4:00 PM" (effectiveStayTimes format) → minutes since local midnight.
function minutesOfLabel(label: string): number {
  const m = label.match(/(\d{1,2}):(\d{2})\s*([AP]M)/i);
  if (!m) return 0;
  let h = parseInt(m[1], 10) % 12;
  if (m[3].toUpperCase() === "PM") h += 12;
  return h * 60 + parseInt(m[2], 10);
}

const MIDNIGHT = 24 * 60;

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function kioskWeather(
  admin: ReturnType<typeof createAdminClient>,
  nickname: string | null,
  today: string
): Promise<KioskWeatherDay[] | null> {
  try {
    const dates = Array.from({ length: WEATHER_DAYS }, (_, i) => addDays(today, i));
    if (nickname) {
      const byDate = await loadWeatherByDate(admin, nickname);
      const days = dates
        .filter((d) => byDate.has(d))
        .map((d) => {
          const w = byDate.get(d)!;
          return { date: d, tempMaxF: w.tempMaxF, precipProb: w.precipProb, label: w.label, emoji: w.emoji };
        });
      if (days.length) return days;
    }
    const forecast = await fetchForecast(KIOSK_FALLBACK_COORDS.lat, KIOSK_FALLBACK_COORDS.lng);
    return forecast
      .filter((d) => dates.includes(d.date))
      .map((d) => ({
        date: d.date,
        tempMaxF: d.tempMaxF,
        precipProb: d.precipProb,
        ...describeCode(d.code),
      }));
  } catch {
    return null;
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const admin = createAdminClient();

  // Generic 404 — don't reveal whether the token or the route is wrong.
  const access = await resolveKioskAccess(
    admin,
    token,
    request.headers.get("x-kiosk-device")
  );
  if (!access) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // This payload includes a signed guest token for the current booking, so it
  // only goes to devices that have done the one-time PIN exchange.
  if (!access.authorized) {
    return NextResponse.json({ error: "pin_required" }, { status: 401 });
  }
  const property = access.property;

  const tz = property.timezone || "America/New_York";
  let today = todayInTz(tz);
  let nowMin = localMinutesInTz(tz);
  if (process.env.NODE_ENV === "development") {
    const url = new URL(request.url);
    const dateOverride = url.searchParams.get("date");
    const hourOverride = url.searchParams.get("hour"); // "15" or "15:30"
    if (dateOverride && /^\d{4}-\d{2}-\d{2}$/.test(dateOverride)) today = dateOverride;
    if (hourOverride) {
      const [h, m] = hourOverride.split(":");
      nowMin = parseInt(h, 10) * 60 + (m ? parseInt(m, 10) : 0);
    }
  }

  // Some houses have two property rows sharing a nickname (active + legacy);
  // bookings can sit on either.
  let propertyIds = property.nickname
    ? await nicknamePropertyIds(admin, property.nickname)
    : [property.id];
  if (propertyIds.length === 0) propertyIds = [property.id];

  // `upsells` rides along: paid early check-in / late checkout purchases move
  // the screen-switch boundaries below.
  const { data: regs } = await admin
    .from("registration")
    .select(`${registrationSessionSelect}, upsells`)
    .in("property_id", propertyIds)
    .in("status", ["active", "completed"])
    .lte("check_in_date", today)
    .gte("check_out_date", today)
    .order("check_in_date", { ascending: false });

  const rows = (regs ?? []) as unknown as RegRow[];
  const staying = rows.filter((r) => r.check_out_date > today);
  const departing = rows.filter((r) => r.check_out_date === today);

  // Sibling rows can duplicate the same stay — prefer the kiosk's own row.
  const pick = (list: RegRow[]) =>
    list.find((r) => r.property?.id === property.id) ?? list[0];

  type Upsells = Parameters<typeof effectiveStayTimes>[0];
  const dep = departing.length ? pick(departing) : null;
  const stay = staying.length ? pick(staying) : null;
  // The day's real boundaries: the departing guest's screen holds until their
  // checkout time and the arriving guest's starts at their check-in time —
  // in between, the house is the cleaner's.
  const depOutMin = dep ? minutesOfLabel(effectiveStayTimes(dep.upsells as Upsells).checkOutTime) : null;
  const stayInMin =
    stay && stay.check_in_date === today
      ? minutesOfLabel(effectiveStayTimes(stay.upsells as Upsells).checkInTime)
      : null;

  let chosen: RegRow | null = null;
  let state: KioskState = "none";
  if (dep && depOutMin !== null && nowMin < depOutMin) {
    chosen = dep;
    state = "checkout_day";
  } else if (stay) {
    if (stayInMin !== null && nowMin < stayInMin) {
      // Turnover window on arrival day — stays "none" so the cleaner screen
      // shows; the arriving booking surfaces as next_booking below.
      chosen = null;
    } else {
      chosen = stay;
      state = stay.check_in_date === today ? "arrival_day" : "mid_stay";
    }
  }

  // When the screen should flip next: the earliest boundary still ahead
  // today, else midnight (date roll). The client refetches then.
  const upcoming = [depOutMin, stayInMin].filter(
    (m): m is number => m !== null && m > nowMin
  );
  const nextBoundaryMin = upcoming.length ? Math.min(...upcoming) : MIDNIGHT;
  const refreshInSeconds = (nextBoundaryMin - nowMin) * 60;

  let booking = null;
  if (chosen) {
    const payload = await buildGuestSessionPayload(chosen);
    booking = { first_name: firstNameOf(payload.guest_name), ...payload };
  }

  // Vacant house → the kiosk shows the cleaner welcome screen; give it the
  // next arrival so the turnover crew knows what they're prepping for, plus
  // the assigned cleaner's name for the greeting and a short calendar of
  // upcoming stays.
  let nextBooking = null;
  let upcomingBookings: KioskUpcoming[] = [];
  let cleanerName: string | null = null;
  if (!chosen) {
    const { data: upcoming } = await admin
      .from("registration")
      .select("check_in_date, check_out_date, num_guests, pets, upsells, guest:guest_id(full_name)")
      .in("property_id", propertyIds)
      .eq("status", "active")
      .gte("check_in_date", today)
      .order("check_in_date", { ascending: true })
      .limit(UPCOMING_LIMIT);

    upcomingBookings = (upcoming ?? []).map((row) => {
      const guest = row.guest as unknown as { full_name: string } | null;
      // Times pre-formatted ("4:00 PM"), honoring paid early check-in / late
      // checkout; the flags drive the calendar badges.
      const t = effectiveStayTimes(row.upsells as Upsells);
      return {
        check_in_date: row.check_in_date,
        check_out_date: row.check_out_date,
        check_in_time: t.checkInTime,
        check_out_time: t.checkOutTime,
        has_early_checkin: t.hasEarlyCheckin,
        has_late_checkout: t.hasLateCheckout,
        first_name: guest?.full_name ? firstNameOf(guest.full_name) : null,
        num_guests: row.num_guests,
        pets: Array.isArray(row.pets) ? row.pets.length : 0,
      };
    });
    nextBooking = upcomingBookings[0] ?? null;

    const { data: assignments } = await admin
      .from("cleaner_property")
      .select("cleaner:cleaner_id(name, is_active)")
      .in("property_id", propertyIds);
    const cleaner = (assignments ?? [])
      .map((a) => a.cleaner as unknown as { name: string; is_active: boolean } | null)
      .find((c) => c?.is_active);
    cleanerName = cleaner?.name ? firstNameOf(cleaner.name) : null;
  }

  const photos =
    getCleanPhotos(property.name)?.slice(0, MAX_PHOTOS) ??
    (property.cover_image_url ? [property.cover_image_url] : []);

  const weather = await kioskWeather(admin, property.nickname, today);

  // Drives whether the House Album tile shows — hide it until a photo is live.
  const housePhotoCount = await countPublishedHousePhotos(admin, propertyIds);

  // Which community the house sits in drives the Explore screen + help card.
  const { data: hoaRow } = await admin
    .from("property")
    .select("hoa_type, owner_phone")
    .eq("id", property.id)
    .single();

  return NextResponse.json(
    {
      property: {
        id: property.id,
        name: property.name,
        slug: property.slug,
        address: property.address,
        timezone: tz,
        community: hoaRow?.hoa_type === "bmlc" ? "blue-mountain-lake" : "penn-estates",
        host_phone: hoaRow?.owner_phone ?? null,
      },
      today,
      state,
      photos,
      wifi: access.wifi,
      weather,
      booking,
      next_booking: nextBooking,
      upcoming_bookings: upcomingBookings,
      cleaner_name: cleanerName,
      refresh_in_seconds: refreshInSeconds,
      house_photo_count: housePhotoCount,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
