// Weather-aware pricing input (a differentiator — PriceLabs prices on market
// data only). Free 16-day daily forecast from Open-Meteo (no API key), scored
// into a 0..1 "desirability" for a warm, dry lake getaway. The engine turns
// that into a bounded near-term premium/discount; only forecastable dates
// (~16 days out) are affected.

import { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

export interface ForecastDay {
  date: string;
  tempMaxF: number | null;
  tempMinF: number | null;
  precipProb: number | null; // %
  precipMm: number | null;
  code: number | null; // WMO weather code
}

export interface WeatherPoint {
  desirability: number; // 0..1
  tempMaxF: number | null;
  precipProb: number | null;
  code: number | null;
  label: string;
  emoji: string;
}

// WMO weather code → short label + emoji.
export function describeCode(code: number | null): { label: string; emoji: string } {
  if (code == null) return { label: "—", emoji: "" };
  if (code === 0) return { label: "Clear", emoji: "☀️" };
  if (code <= 2) return { label: "Partly cloudy", emoji: "🌤️" };
  if (code === 3) return { label: "Cloudy", emoji: "☁️" };
  if (code <= 48) return { label: "Fog", emoji: "🌫️" };
  if (code <= 57) return { label: "Drizzle", emoji: "🌦️" };
  if (code <= 67) return { label: "Rain", emoji: "🌧️" };
  if (code <= 77) return { label: "Snow", emoji: "❄️" };
  if (code <= 82) return { label: "Showers", emoji: "🌧️" };
  if (code <= 86) return { label: "Snow showers", emoji: "🌨️" };
  return { label: "Thunderstorm", emoji: "⛈️" };
}

// The forecast's dominant WMO weather code — a storm/rain/snow day is a poor
// lake getaway even when the max precip *probability* reads modest, so the code
// caps desirability directly. Without this, a warm thunderstorm day scored high
// on temperature alone and wrongly earned a premium.
function conditionScore(code: number | null): number {
  if (code == null) return 1;
  if (code === 0) return 1.0; // clear
  if (code <= 2) return 0.98; // partly cloudy
  if (code === 3) return 0.92; // cloudy
  if (code <= 48) return 0.82; // fog
  if (code <= 57) return 0.68; // drizzle
  if (code <= 67) return 0.5; // rain
  if (code <= 77) return 0.4; // snow
  if (code <= 82) return 0.5; // showers
  if (code <= 86) return 0.4; // snow showers
  return 0.3; // thunderstorm
}

/** Desirability for a warm-weather lake/outdoor getaway: comfortable warmth ×
 *  dryness × the forecast conditions. Peaks ~78–86°F and clear; collapses when
 *  cold, wet, or stormy. */
export function desirability(day: ForecastDay): number {
  const t = day.tempMaxF;
  let tempScore: number;
  if (t == null) tempScore = 0.55;
  else if (t < 50) tempScore = 0.08;
  else if (t < 68) tempScore = 0.08 + ((t - 50) / 18) * 0.62; // 0.08 → 0.70
  else if (t <= 86) tempScore = 0.7 + ((t - 68) / 18) * 0.3; // 0.70 → 1.00
  else if (t <= 95) tempScore = 1.0 - ((t - 86) / 9) * 0.35; // 1.00 → 0.65
  else tempScore = 0.5;

  const prob = day.precipProb ?? 0;
  const mm = day.precipMm ?? 0;
  // Dryness: high probability or meaningful accumulation both cut the score.
  const probPenalty = Math.min(prob / 100, 1) * 0.6;
  const mmPenalty = Math.min(mm / 15, 1) * 0.5;
  const precipScore = Math.max(0.15, 1 - Math.max(probPenalty, mmPenalty));

  return Math.max(0, Math.min(1, tempScore * precipScore * conditionScore(day.code)));
}

const OPEN_METEO = "https://api.open-meteo.com/v1/forecast";

export async function fetchForecast(lat: number, lng: number): Promise<ForecastDay[]> {
  const url =
    `${OPEN_METEO}?latitude=${lat}&longitude=${lng}` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,weathercode` +
    `&temperature_unit=fahrenheit&timezone=America%2FNew_York&forecast_days=16`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const j = (await res.json()) as {
    daily?: {
      time: string[];
      temperature_2m_max: (number | null)[];
      temperature_2m_min: (number | null)[];
      precipitation_probability_max: (number | null)[];
      precipitation_sum: (number | null)[];
      weathercode: (number | null)[];
    };
  };
  const d = j.daily;
  if (!d) throw new Error("Open-Meteo: no daily data");
  return d.time.map((date, i) => ({
    date,
    tempMaxF: d.temperature_2m_max[i],
    tempMinF: d.temperature_2m_min[i],
    precipProb: d.precipitation_probability_max[i],
    precipMm: d.precipitation_sum[i],
    code: d.weathercode[i],
  }));
}

/** Fetch + score + upsert the forecast for one house. */
export async function upsertForecast(
  admin: Admin,
  nickname: string,
  lat: number,
  lng: number
): Promise<number> {
  const days = await fetchForecast(lat, lng);
  const now = new Date().toISOString();
  const rows = days.map((day) => ({
    nickname,
    stay_date: day.date,
    fetched_at: now,
    temp_max_f: day.tempMaxF,
    temp_min_f: day.tempMinF,
    precip_prob: day.precipProb,
    precip_mm: day.precipMm,
    weather_code: day.code,
    desirability: Math.round(desirability(day) * 1000) / 1000,
  }));
  const { error } = await admin
    .from("weather_forecast")
    .upsert(rows, { onConflict: "nickname,stay_date" });
  if (error) throw new Error(`weather upsert: ${error.message}`);
  return rows.length;
}

/** Latest forecast per stay date for a house. */
export async function loadWeatherByDate(admin: Admin, nickname: string): Promise<Map<string, WeatherPoint>> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await admin
    .from("weather_forecast")
    .select("stay_date, desirability, temp_max_f, precip_prob, weather_code")
    .ilike("nickname", nickname)
    .gte("stay_date", today)
    .order("stay_date");
  const out = new Map<string, WeatherPoint>();
  for (const r of data ?? []) {
    if (r.desirability == null) continue;
    const { label, emoji } = describeCode(r.weather_code);
    out.set(r.stay_date, {
      desirability: r.desirability,
      tempMaxF: r.temp_max_f,
      precipProb: r.precip_prob,
      code: r.weather_code,
      label,
      emoji,
    });
  }
  return out;
}
