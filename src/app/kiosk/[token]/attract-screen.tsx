"use client";

import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import type { KioskData, KioskWeatherCurrent } from "./types";
import { useNow } from "./ui";

const SLIDE_MS = 9000;
const WX_REFRESH_MS = 10 * 60 * 1000;

function weekdayShort(dateStr: string, today: string): string {
  if (dateStr === today) return "Today";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });
}

const STATE_ABBR: Record<string, string> = {
  Pennsylvania: "PA",
  "New Jersey": "NJ",
  "New York": "NY",
};

// Stored as "Street, Number, City, State, Zip" — render as a normal US address.
function formatAddress(raw: string): string {
  const p = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (p.length === 5 && /^\d+$/.test(p[1])) {
    return `${p[1]} ${p[0]}, ${p[2]}, ${STATE_ABBR[p[3]] ?? p[3]} ${p[4]}`;
  }
  return raw;
}

export function AttractScreen({
  token,
  data,
  onWake,
  onWeather,
}: {
  token: string;
  data: KioskData;
  onWake: () => void;
  onWeather: () => void;
}) {
  const now = useNow(1000);
  const [slide, setSlide] = useState(0);
  const [current, setCurrent] = useState<KioskWeatherCurrent | null>(null);
  const photos = data.photos.length ? data.photos : [];

  useEffect(() => {
    if (photos.length < 2) return;
    const t = setInterval(() => setSlide((s) => (s + 1) % photos.length), SLIDE_MS);
    return () => clearInterval(t);
  }, [photos.length]);

  // Live current conditions for the hero (the daily payload only has the high).
  useEffect(() => {
    let cancelled = false;
    const fetchCurrent = async () => {
      try {
        const res = await fetch(`/api/kiosk/${token}/weather`, { cache: "no-store" });
        if (!res.ok) return;
        const j = (await res.json()) as { current: KioskWeatherCurrent | null };
        if (!cancelled) setCurrent(j.current ?? null);
      } catch {
        // keep the daily fallback
      }
    };
    fetchCurrent();
    const t = setInterval(fetchCurrent, WX_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [token]);

  const tz = data.property.timezone;
  const time = now.toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" });
  const date = now.toLocaleDateString("en-US", { timeZone: tz, weekday: "long", month: "long", day: "numeric" });

  // Prefer live current conditions; fall back to today's daily forecast.
  const todayW = data.weather?.find((w) => w.date === data.today) ?? data.weather?.[0];
  const wxTemp = current?.tempF ?? todayW?.tempMaxF ?? null;
  const wxEmoji = current?.emoji ?? todayW?.emoji ?? "";
  const wxLabel = current?.label ?? todayW?.label ?? "";
  const wxFeels = current?.feelsF ?? null;

  return (
    <div
      onPointerDown={onWake}
      className="absolute inset-0 block h-full w-full cursor-pointer text-left"
      role="button"
      aria-label="Touch to begin"
    >
      <style>{`
        @keyframes kiosk-drift-a { from { transform: scale(1.05) translate(0, 0); } to { transform: scale(1.14) translate(-1.5%, -1%); } }
        @keyframes kiosk-drift-b { from { transform: scale(1.05) translate(0, 0); } to { transform: scale(1.14) translate(1.5%, 1%); } }
      `}</style>

      {/* Slideshow — only the active and previous slides stay mounted */}
      {photos.map((src, i) => {
        const prev = (slide + photos.length - 1) % photos.length;
        if (i !== slide && i !== prev) return null;
        return (
          <div
            key={src}
            className="absolute inset-0 transition-opacity duration-2000 ease-in-out"
            style={{ opacity: i === slide ? 1 : 0 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              className="h-full w-full object-cover"
              style={{ animation: `${i % 2 ? "kiosk-drift-b" : "kiosk-drift-a"} ${SLIDE_MS + 3000}ms ease-out forwards` }}
            />
          </div>
        );
      })}
      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/95 via-zinc-950/30 to-zinc-950/50" />

      {/* Top strip: property name + BIG current weather */}
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-6 p-8 lg:p-12">
        <span className="max-w-[40%] text-sm font-semibold uppercase tracking-[0.35em] text-white/70">
          {data.property.name}
        </span>
        {wxTemp != null && (
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onWeather();
            }}
            className="flex flex-col items-end gap-2"
            aria-label="Open the full weather forecast"
          >
            <div className="flex items-center gap-4">
              <span className="text-6xl leading-none lg:text-7xl">{wxEmoji}</span>
              <span className="text-7xl font-bold leading-none tracking-tight text-white tabular-nums lg:text-8xl">
                {Math.round(wxTemp)}°
              </span>
            </div>
            <div className="text-right">
              <p className="text-xl font-medium text-white/90 lg:text-2xl">{wxLabel}</p>
              {wxFeels != null && (
                <p className="text-base text-white/60 lg:text-lg">Feels like {Math.round(wxFeels)}°</p>
              )}
            </div>
            {data.weather && data.weather.length > 0 && (
              <div className="mt-1 flex gap-2">
                {data.weather.slice(0, 3).map((w) => (
                  <span
                    key={w.date}
                    className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium text-white/90 backdrop-blur-md"
                  >
                    <span className="text-white/60">{weekdayShort(w.date, data.today)}</span>
                    <span>{w.emoji}</span>
                    {w.tempMaxF != null && <span>{Math.round(w.tempMaxF)}°</span>}
                  </span>
                ))}
              </div>
            )}
          </button>
        )}
      </div>

      {/* Bottom: clock + date + address (left), greeting + prompt (right) */}
      <div className="absolute inset-x-0 bottom-0 p-8 lg:p-12">
        <div className="flex items-end justify-between gap-8">
          <div className="min-w-0">
            <p className="text-[clamp(3.5rem,9vw,8rem)] font-bold leading-none tracking-tight text-white tabular-nums">
              {time}
            </p>
            <p className="mt-3 text-xl font-medium text-white/70 lg:text-2xl">{date}</p>
            {data.property.address && (
              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/50">Your address</p>
                <p className="mt-1 flex items-center gap-2 text-lg font-semibold text-white/90 lg:text-2xl">
                  <MapPin className="h-5 w-5 shrink-0 text-white/60 lg:h-6 lg:w-6" />
                  {formatAddress(data.property.address)}
                </p>
              </div>
            )}
          </div>
          <div className="min-w-0 max-w-[55%] text-right">
            <p className="text-[clamp(2.5rem,6vw,5.5rem)] font-bold leading-[1.05] tracking-tight text-white text-balance">
              {data.booking
                ? `Welcome to the Poconos, ${data.booking.first_name}!`
                : "Welcome to the Poconos!"}
            </p>
            <span className="mt-6 inline-flex animate-pulse items-center gap-3 rounded-full bg-white/15 px-6 py-3 text-base font-semibold text-white backdrop-blur-md lg:text-lg">
              Touch the screen to begin
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
