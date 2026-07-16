"use client";

import { useEffect, useState } from "react";
import { MapPin, Wifi } from "lucide-react";
import type { KioskData, KioskWeatherCurrent } from "./types";
import { useNow } from "./ui";

const SLIDE_MS = 9000;
const WX_REFRESH_MS = 10 * 60 * 1000;

// Per the Wi-Fi QR spec, these characters must be backslash-escaped in SSID/pass.
function escapeWifi(value: string): string {
  return value.replace(/([\\;,:"])/g, "\\$1");
}
function wifiQrPayload(ssid: string, password: string | null): string {
  return password
    ? `WIFI:T:WPA;S:${escapeWifi(ssid)};P:${escapeWifi(password)};;`
    : `WIFI:T:nopass;S:${escapeWifi(ssid)};;`;
}

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
  const [wifiQr, setWifiQr] = useState<string | null>(null);
  const photos = data.photos.length ? data.photos : [];
  const wifi = data.wifi;

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

  // Guest Wi-Fi QR — scan to join without typing the password.
  useEffect(() => {
    if (!wifi?.ssid) {
      setWifiQr(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const QRCode = (await import("qrcode")).default;
        const dataUrl = await QRCode.toDataURL(wifiQrPayload(wifi.ssid, wifi.password), {
          width: 320,
          margin: 1,
          errorCorrectionLevel: "M",
          color: { dark: "#0a0a0a", light: "#ffffff" },
        });
        if (!cancelled) setWifiQr(dataUrl);
      } catch {
        // No QR — the network name + password are still shown below it.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wifi?.ssid, wifi?.password]);

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

      {/* Center hero: the greeting owns the screen, touch prompt beneath it */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-10 px-12 text-center">
        <p className="max-w-[16ch] text-[clamp(3rem,7.5vw,7rem)] font-bold leading-[1.05] tracking-tight text-white text-balance drop-shadow-[0_4px_24px_rgba(0,0,0,0.45)]">
          {data.booking
            ? `Welcome to the Poconos, ${data.booking.first_name}!`
            : "Welcome to the Poconos!"}
        </p>
        <span className="inline-flex animate-pulse items-center gap-3 rounded-full bg-white/15 px-7 py-3.5 text-lg font-semibold text-white backdrop-blur-md lg:text-xl">
          Touch the screen to begin
        </span>
      </div>

      {/* Bottom corners: clock + date (left); Wi-Fi + address (right) */}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-8 p-8 lg:p-12">
        <div className="min-w-0">
          <p className="whitespace-nowrap text-[clamp(2.25rem,4.5vw,4rem)] font-bold leading-none tracking-tight text-white tabular-nums">
            {time}
          </p>
          <p className="mt-2 text-lg font-medium text-white/70 lg:text-xl">{date}</p>
        </div>
        <div className="flex min-w-0 flex-col items-end gap-4">
          {wifi?.ssid && (
            <div
              onPointerDown={(e) => e.stopPropagation()}
              className="flex items-center gap-4 rounded-3xl bg-black/35 p-4 ring-1 ring-white/15 backdrop-blur-md"
            >
              {wifiQr && (
                <div className="shrink-0 rounded-2xl bg-white p-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={wifiQr} alt="Scan to join the Wi-Fi" className="h-24 w-24 lg:h-28 lg:w-28" />
                </div>
              )}
              <div className="min-w-0 text-left">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.25em] text-white/60">
                  <Wifi className="h-4 w-4" /> Guest Wi-Fi
                </p>
                <p className="mt-1 truncate text-xl font-bold text-white lg:text-2xl">{wifi.ssid}</p>
                {wifi.password && (
                  <p className="text-base text-white/75 lg:text-lg">
                    Password <span className="font-semibold text-white tabular-nums">{wifi.password}</span>
                  </p>
                )}
                {wifiQr && <p className="mt-1 text-xs text-white/50">Scan to connect</p>}
              </div>
            </div>
          )}
          {data.property.address && (
            <div className="min-w-0 text-right">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/50">
                Your address
              </p>
              <p className="mt-1.5 flex items-center justify-end gap-2 text-lg font-semibold text-white/90 lg:text-xl">
                <MapPin className="h-5 w-5 shrink-0 text-white/60" />
                {formatAddress(data.property.address)}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
