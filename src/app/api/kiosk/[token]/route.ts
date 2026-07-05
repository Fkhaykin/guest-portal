import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { nicknamePropertyIds } from "@/lib/pricing/data";
import { todayInTz } from "@/lib/pricing/engine";
import { firstNameOf } from "@/lib/guest-messages/templates";
import { getAirbnbPhotos } from "@/lib/airbnb-photos";
import { loadWeatherByDate, fetchForecast, describeCode } from "@/lib/pricing/weather";
import {
  buildGuestSessionPayload,
  registrationSessionSelect,
} from "@/lib/guest-session-payload";

// Back-to-back turnover: greet the departing guest until this local hour,
// then switch to the arriving one.
const TURNOVER_SWITCH_HOUR = 12;
// Checkout day with nobody arriving: stop greeting the departed guest after
// this local hour.
const CHECKOUT_STALE_HOUR = 14;

const MAX_PHOTOS = 12;
const WEATHER_DAYS = 5;
// All houses sit in the same lake community — one fallback coordinate is
// meteorologically identical when a house has no cached forecast.
const FALLBACK_LAT = 41.32;
const FALLBACK_LNG = -75.38;

type KioskState = "arrival_day" | "mid_stay" | "checkout_day" | "none";

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

function localHourInTz(tz: string): number {
  return parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date()),
    10
  );
}

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
    const forecast = await fetchForecast(FALLBACK_LAT, FALLBACK_LNG);
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
  const { data: kioskRow } = await admin
    .from("kiosk")
    .select("property_id")
    .eq("token", token)
    .maybeSingle();
  if (!kioskRow) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: property } = await admin
    .from("property")
    .select("id, name, slug, nickname, address, timezone, cover_image_url")
    .eq("id", kioskRow.property_id)
    .single();
  if (!property) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const tz = property.timezone || "America/New_York";
  let today = todayInTz(tz);
  let localHour = localHourInTz(tz);
  if (process.env.NODE_ENV === "development") {
    const url = new URL(request.url);
    const dateOverride = url.searchParams.get("date");
    const hourOverride = url.searchParams.get("hour");
    if (dateOverride && /^\d{4}-\d{2}-\d{2}$/.test(dateOverride)) today = dateOverride;
    if (hourOverride) localHour = parseInt(hourOverride, 10);
  }

  // Some houses have two property rows sharing a nickname (active + legacy);
  // bookings can sit on either.
  let propertyIds = property.nickname
    ? await nicknamePropertyIds(admin, property.nickname)
    : [property.id];
  if (propertyIds.length === 0) propertyIds = [property.id];

  const { data: regs } = await admin
    .from("registration")
    .select(registrationSessionSelect)
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

  let chosen: RegRow | null = null;
  let state: KioskState = "none";
  if (staying.length && departing.length) {
    if (localHour < TURNOVER_SWITCH_HOUR) {
      chosen = pick(departing);
      state = "checkout_day";
    } else {
      chosen = pick(staying);
      state = "arrival_day";
    }
  } else if (staying.length) {
    chosen = pick(staying);
    state = chosen.check_in_date === today ? "arrival_day" : "mid_stay";
  } else if (departing.length && localHour < CHECKOUT_STALE_HOUR) {
    chosen = pick(departing);
    state = "checkout_day";
  }

  let booking = null;
  if (chosen) {
    const payload = await buildGuestSessionPayload(chosen);
    booking = { first_name: firstNameOf(payload.guest_name), ...payload };
  }

  const photos =
    getAirbnbPhotos(property.name)?.slice(0, MAX_PHOTOS) ??
    (property.cover_image_url ? [property.cover_image_url] : []);

  const weather = await kioskWeather(admin, property.nickname, today);

  return NextResponse.json(
    {
      property: {
        id: property.id,
        name: property.name,
        slug: property.slug,
        address: property.address,
        timezone: tz,
      },
      today,
      state,
      photos,
      weather,
      booking,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
