"use client";

import { useEffect, useState } from "react";
import type { KioskData } from "./types";
import { useNow } from "./ui";

const SLIDE_MS = 9000;

function weekdayShort(dateStr: string, today: string): string {
  if (dateStr === today) return "Today";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });
}

export function AttractScreen({
  data,
  onWake,
  onWeather,
}: {
  data: KioskData;
  onWake: () => void;
  onWeather: () => void;
}) {
  const now = useNow(1000);
  const [slide, setSlide] = useState(0);
  const photos = data.photos.length ? data.photos : [];

  useEffect(() => {
    if (photos.length < 2) return;
    const t = setInterval(() => setSlide((s) => (s + 1) % photos.length), SLIDE_MS);
    return () => clearInterval(t);
  }, [photos.length]);

  const tz = data.property.timezone;
  const time = now.toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" });
  const date = now.toLocaleDateString("en-US", { timeZone: tz, weekday: "long", month: "long", day: "numeric" });

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
      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/95 via-zinc-950/30 to-zinc-950/40" />

      {/* Top strip: property + weather (weather taps straight into the forecast) */}
      <div className="absolute inset-x-0 top-0 flex items-start justify-between p-8 lg:p-12">
        <span className="text-sm font-semibold uppercase tracking-[0.35em] text-white/70">
          {data.property.name}
        </span>
        {data.weather && data.weather.length > 0 && (
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onWeather();
            }}
            className="flex gap-2"
            aria-label="Open the full weather forecast"
          >
            {data.weather.slice(0, 3).map((w) => (
              <span
                key={w.date}
                className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur-md"
              >
                <span className="text-white/60">{weekdayShort(w.date, data.today)}</span>
                <span>{w.emoji}</span>
                {w.tempMaxF != null && <span>{Math.round(w.tempMaxF)}°</span>}
              </span>
            ))}
          </button>
        )}
      </div>

      {/* Bottom: clock + greeting + prompt */}
      <div className="absolute inset-x-0 bottom-0 p-8 lg:p-12">
        <div className="flex items-end justify-between gap-8">
          <div>
            <p className="text-[clamp(3.5rem,9vw,8rem)] font-bold leading-none tracking-tight text-white tabular-nums">
              {time}
            </p>
            <p className="mt-3 text-xl font-medium text-white/70 lg:text-2xl">{date}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold text-white lg:text-3xl text-balance">
              {data.booking ? `Welcome, ${data.booking.first_name}` : `Welcome to ${data.property.name}`}
            </p>
            <span className="mt-5 inline-flex animate-pulse items-center gap-3 rounded-full bg-white/15 px-6 py-3 text-base font-semibold text-white backdrop-blur-md lg:text-lg">
              Touch the screen to begin
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
