import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { describeCode } from "@/lib/pricing/weather";
import { resolveKioskProperty, kioskCoords } from "@/lib/kiosk";

// Full forecast for the kiosk weather screen. Open-Meteo, like the pricing
// engine's daily feed — free, no API key. Radar frames come from RainViewer's
// public API (also key-less); the client composes them over OSM tiles.

const OPEN_METEO = "https://api.open-meteo.com/v1/forecast";
const RAINVIEWER = "https://api.rainviewer.com/public/weather-maps.json";
const HOURLY_HOURS = 48;

interface OpenMeteoFull {
  current?: {
    time: string;
    temperature_2m: number | null;
    apparent_temperature: number | null;
    relative_humidity_2m: number | null;
    precipitation: number | null;
    weather_code: number | null;
    cloud_cover: number | null;
    wind_speed_10m: number | null;
    wind_gusts_10m: number | null;
    wind_direction_10m: number | null;
    is_day: number;
  };
  hourly?: {
    time: string[];
    temperature_2m: (number | null)[];
    apparent_temperature: (number | null)[];
    precipitation_probability: (number | null)[];
    precipitation: (number | null)[];
    weather_code: (number | null)[];
    relative_humidity_2m: (number | null)[];
    wind_speed_10m: (number | null)[];
    uv_index: (number | null)[];
    is_day: number[];
  };
  daily?: {
    time: string[];
    weather_code: (number | null)[];
    temperature_2m_max: (number | null)[];
    temperature_2m_min: (number | null)[];
    precipitation_probability_max: (number | null)[];
    precipitation_sum: (number | null)[];
    sunrise: string[];
    sunset: string[];
    uv_index_max: (number | null)[];
    wind_speed_10m_max: (number | null)[];
  };
}

async function fetchFullForecast(lat: number, lng: number): Promise<OpenMeteoFull> {
  const url =
    `${OPEN_METEO}?latitude=${lat}&longitude=${lng}` +
    `&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_gusts_10m,wind_direction_10m,is_day` +
    `&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,relative_humidity_2m,wind_speed_10m,uv_index,is_day` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,sunrise,sunset,uv_index_max,wind_speed_10m_max` +
    `&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch` +
    `&timezone=America%2FNew_York&forecast_days=8`;
  const res = await fetch(url, { next: { revalidate: 600 } });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  return (await res.json()) as OpenMeteoFull;
}

/** Radar animation frames (last ~2h observed + 30min nowcast). Best-effort. */
async function fetchRadarFrames(): Promise<{
  host: string;
  frames: { time: number; path: string }[];
} | null> {
  try {
    const res = await fetch(RAINVIEWER, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      host?: string;
      radar?: { past?: { time: number; path: string }[]; nowcast?: { time: number; path: string }[] };
    };
    if (!j.host || !j.radar) return null;
    const frames = [...(j.radar.past ?? []), ...(j.radar.nowcast ?? [])];
    return frames.length ? { host: j.host, frames } : null;
  } catch {
    return null;
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const admin = createAdminClient();

  const property = await resolveKioskProperty(admin, token);
  if (!property) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const coords = await kioskCoords(admin, property.nickname);

  let forecast: OpenMeteoFull;
  try {
    forecast = await fetchFullForecast(coords.lat, coords.lng);
  } catch {
    return NextResponse.json({ error: "Forecast unavailable" }, { status: 502 });
  }

  const radar = await fetchRadarFrames();

  // Trim hourly to the window from the current hour forward.
  const h = forecast.hourly;
  let hourly: Record<string, unknown>[] = [];
  if (h) {
    // current.time is minute-granular ("…T14:15") — truncate to the hour so
    // the in-progress hour ("…T14:00") stays in the window; the first entry
    // is what the kiosk labels "Now".
    const nowIso = (forecast.current?.time ?? new Date().toISOString()).slice(0, 13) + ":00";
    let start = h.time.findIndex((t) => t >= nowIso);
    if (start < 0) start = 0;
    hourly = h.time.slice(start, start + HOURLY_HOURS).map((time, idx) => {
      const i = start + idx;
      return {
        time,
        tempF: h.temperature_2m[i],
        feelsF: h.apparent_temperature[i],
        precipProb: h.precipitation_probability[i],
        precipIn: h.precipitation[i],
        humidity: h.relative_humidity_2m[i],
        windMph: h.wind_speed_10m[i],
        uv: h.uv_index[i],
        isDay: h.is_day[i] === 1,
        code: h.weather_code[i],
        ...describeCode(h.weather_code[i]),
      };
    });
  }

  const d = forecast.daily;
  const daily = (d?.time ?? []).map((date, i) => ({
    date,
    tempMaxF: d!.temperature_2m_max[i],
    tempMinF: d!.temperature_2m_min[i],
    precipProb: d!.precipitation_probability_max[i],
    precipIn: d!.precipitation_sum[i],
    sunrise: d!.sunrise[i],
    sunset: d!.sunset[i],
    uvMax: d!.uv_index_max[i],
    windMaxMph: d!.wind_speed_10m_max[i],
    code: d!.weather_code[i],
    ...describeCode(d!.weather_code[i]),
  }));

  const c = forecast.current;
  return NextResponse.json(
    {
      location: { lat: coords.lat, lng: coords.lng, name: property.nickname ?? property.name },
      current: c
        ? {
            time: c.time,
            tempF: c.temperature_2m,
            feelsF: c.apparent_temperature,
            humidity: c.relative_humidity_2m,
            precipIn: c.precipitation,
            cloudCover: c.cloud_cover,
            windMph: c.wind_speed_10m,
            windGustMph: c.wind_gusts_10m,
            windDir: c.wind_direction_10m,
            isDay: c.is_day === 1,
            code: c.weather_code,
            ...describeCode(c.weather_code),
          }
        : null,
      hourly,
      daily,
      radar,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
