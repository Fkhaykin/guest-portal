"use client";

import { useEffect, useState } from "react";
import {
  Cloud,
  Droplets,
  Pause,
  Play,
  Sun,
  Sunrise,
  Sunset,
  Umbrella,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { KioskEmpty, KioskScreenShell, KioskSpinner, glassButton, glassPanel, useNow } from "../ui";
import type { KioskData, KioskWeatherFull } from "../types";

// ---------------------------------------------------------------------------
// Helpers — every metric from the API is nullable, so all formatters degrade
// to "—" instead of throwing.
// ---------------------------------------------------------------------------

function num(v: number | null | undefined, suffix = ""): string {
  return v == null || !Number.isFinite(v) ? "—" : `${Math.round(v)}${suffix}`;
}

/** hourly[].time is "YYYY-MM-DDTHH:00" already in the property's timezone —
 *  read HH straight out of the string, never round-trip through Date. */
function hourLabel(time: string): string {
  const hh = Number(time.slice(11, 13));
  if (!Number.isFinite(hh)) return "—";
  if (hh === 0) return "12 AM";
  if (hh === 12) return "12 PM";
  return hh > 12 ? `${hh - 12} PM` : `${hh} AM`;
}

/** daily[].sunrise/sunset are "YYYY-MM-DDTHH:MM" property-local strings. */
function sunTime(iso: string | null | undefined): string {
  const t = iso?.split("T")[1];
  if (!t) return "—";
  const [h, m] = t.split(":");
  const hn = Number(h);
  if (!Number.isFinite(hn) || !m) return "—";
  const h12 = hn % 12 === 0 ? 12 : hn % 12;
  return `${h12}:${m.slice(0, 2)} ${hn >= 12 ? "PM" : "AM"}`;
}

function weekdayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", { weekday: "short" });
}

function uvWord(uv: number): string {
  const u = Math.round(uv);
  if (u <= 2) return "Low";
  if (u <= 5) return "Moderate";
  if (u <= 7) return "High";
  return "Very high";
}

const sectionHeading = "mb-4 text-base font-bold uppercase tracking-[0.3em] text-white/50 lg:text-lg";

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export function WeatherScreen({
  token,
  data,
  onBack,
}: {
  token: string;
  data: KioskData;
  onBack: () => void;
}) {
  const [weather, setWeather] = useState<KioskWeatherFull | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/kiosk/${token}/weather`, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as KioskWeatherFull;
        if (!cancelled) setWeather(json);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const current = weather?.current ?? null;
  const hours = weather?.hourly?.slice(0, 24) ?? [];
  const daily = weather?.daily ?? [];
  const d0 = daily[0] ?? null;

  // 8-day global temperature range for the min→max bars.
  const mins = daily.map((d) => d.tempMinF).filter((v): v is number => v != null);
  const maxs = daily.map((d) => d.tempMaxF).filter((v): v is number => v != null);
  const gMin = mins.length ? Math.min(...mins) : null;
  const gMax = maxs.length ? Math.max(...maxs) : null;
  const range = gMin != null && gMax != null ? Math.max(gMax - gMin, 1) : null;

  return (
    <KioskScreenShell
      title="Weather"
      subtitle={`Local forecast at ${data.property.name}`}
      timezone={data.property.timezone}
      onBack={onBack}
    >
      {weather === null ? (
        failed ? (
          <KioskEmpty message="The forecast isn't loading right now — give it another try in a minute." />
        ) : (
          <KioskSpinner />
        )
      ) : (
        <div className="w-full space-y-8 pb-8">
          {/* ---- Current conditions hero ---- */}
          {current && (
            <div className={`flex flex-wrap items-center gap-x-8 gap-y-4 p-6 lg:p-8 ${glassPanel}`}>
              <span className="text-8xl font-bold tracking-tight text-white tabular-nums lg:text-9xl">
                {num(current.tempF, "°")}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <span className="text-4xl lg:text-5xl">{current.emoji}</span>
                  <span className="text-2xl font-semibold text-white lg:text-3xl">{current.label}</span>
                </div>
                <p className="mt-1.5 text-lg text-white/60">Feels like {num(current.feelsF, "°")}</p>
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white/80">
                  <Droplets className="h-4 w-4 text-sky-300" />
                  {num(current.humidity, "%")} humidity
                </span>
                <span className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white/80">
                  <Wind className="h-4 w-4 text-white/60" />
                  {num(current.windMph)} mph
                  {current.windGustMph != null && ` · gusts ${Math.round(current.windGustMph)}`}
                </span>
                <span className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white/80">
                  <Cloud className="h-4 w-4 text-white/60" />
                  {num(current.cloudCover, "%")} clouds
                </span>
              </div>
            </div>
          )}

          {/* ---- Next 24 hours ---- */}
          {hours.length > 0 && (
            <section>
              <h2 className={sectionHeading}>Next 24 hours</h2>
              <div className="-mx-6 flex snap-x gap-2 overflow-x-auto px-6 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {hours.map((h, i) => (
                  <div
                    key={h.time}
                    className={`flex w-20 shrink-0 snap-start flex-col items-center gap-1.5 py-4 ${glassPanel}`}
                  >
                    <span className="text-xs font-semibold uppercase text-white/60">
                      {i === 0 ? "Now" : hourLabel(h.time)}
                    </span>
                    <span className="text-2xl">{h.emoji}</span>
                    <span className="text-lg font-bold text-white tabular-nums">{num(h.tempF, "°")}</span>
                    <span className="text-xs font-semibold text-sky-300 tabular-nums">
                      {h.precipProb != null && h.precipProb >= 20 ? `${Math.round(h.precipProb)}%` : " "}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ---- 8-day forecast ---- */}
          {daily.length > 0 && (
            <section>
              <h2 className={sectionHeading}>8-day forecast</h2>
              <div className={`px-5 py-2 lg:px-6 ${glassPanel}`}>
                <div className="divide-y divide-white/5">
                  {daily.map((d, i) => {
                    const hasBar = range != null && gMin != null && d.tempMinF != null && d.tempMaxF != null;
                    const left = hasBar ? ((d.tempMinF! - gMin!) / range!) * 100 : 0;
                    const width = hasBar
                      ? Math.max(((d.tempMaxF! - d.tempMinF!) / range!) * 100, 3)
                      : 0;
                    return (
                      <div key={d.date} className="flex min-h-14 items-center gap-3 py-2.5 lg:gap-4">
                        <span className="w-16 shrink-0 text-base font-semibold text-white lg:w-20">
                          {i === 0 ? "Today" : weekdayLabel(d.date)}
                        </span>
                        <span className="w-9 shrink-0 text-center text-2xl">{d.emoji}</span>
                        <span className="hidden min-w-0 flex-1 truncate text-base text-white/60 sm:block">
                          {d.label}
                        </span>
                        <span className="w-12 shrink-0 text-right text-sm font-semibold text-sky-300 tabular-nums">
                          {d.precipProb != null && d.precipProb >= 20 ? `${Math.round(d.precipProb)}%` : ""}
                        </span>
                        <span className="w-10 shrink-0 text-right text-base font-semibold text-white/50 tabular-nums">
                          {num(d.tempMinF, "°")}
                        </span>
                        <div className="relative h-1.5 w-28 shrink-0 rounded-full bg-white/10 sm:w-44 lg:w-64">
                          {hasBar && (
                            <div
                              className="absolute inset-y-0 rounded-full bg-linear-to-r from-sky-400 to-amber-400"
                              style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%` }}
                            />
                          )}
                        </div>
                        <span className="w-10 shrink-0 text-base font-bold text-white tabular-nums">
                          {num(d.tempMaxF, "°")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {/* ---- Detail tiles ---- */}
          {(d0 || current) && (
            <section>
              <h2 className={sectionHeading}>Details</h2>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <DetailTile
                  icon={Sun}
                  label="UV index"
                  value={num(d0?.uvMax)}
                  sub={d0?.uvMax != null ? uvWord(d0.uvMax) : undefined}
                />
                <DetailTile icon={Sunrise} label="Sunrise" value={sunTime(d0?.sunrise)} />
                <DetailTile icon={Sunset} label="Sunset" value={sunTime(d0?.sunset)} />
                <DetailTile
                  icon={Umbrella}
                  label="Precipitation"
                  value={d0?.precipIn != null ? `${d0.precipIn.toFixed(2)} in` : "—"}
                  sub="expected today"
                />
                <DetailTile
                  icon={Wind}
                  label="Wind"
                  value={num(d0?.windMaxMph, " mph")}
                  sub="max today"
                />
                <DetailTile
                  icon={Droplets}
                  label="Humidity"
                  value={num(current?.humidity, "%")}
                  sub="right now"
                />
              </div>
            </section>
          )}

          {/* ---- Live radar ---- */}
          {weather.radar && weather.radar.frames.length > 0 && (
            <section>
              <h2 className={sectionHeading}>Precipitation radar</h2>
              <RadarPanel
                radar={weather.radar}
                lat={weather.location.lat}
                lng={weather.location.lng}
                timezone={data.property.timezone}
              />
            </section>
          )}
        </div>
      )}
    </KioskScreenShell>
  );
}

// ---------------------------------------------------------------------------
// Detail tile
// ---------------------------------------------------------------------------

function DetailTile({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 p-5 ${glassPanel}`}>
      <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/50">
        <Icon className="h-4 w-4" />
        {label}
      </span>
      <span className="text-2xl font-bold text-white tabular-nums">{value}</span>
      {sub && <span className="text-sm text-white/50">{sub}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Radar: OSM base tiles + RainViewer overlay, composited with slippy-map math
// at a fixed zoom. 5×4 grid of 256px tiles positioned by percentage, so the
// house marker lands at its exact fractional position without any map library.
// ---------------------------------------------------------------------------

const RADAR_ZOOM = 9;
// RainViewer serves real data only up to z7 (z8+ returns "zoom not supported"
// placeholder tiles) — so the rain overlay renders z7 tiles scaled 4×, each
// covering a 4×4 block of the z9 base grid. Radar blobs upscale fine.
const RADAR_OVERLAY_ZOOM = 7;
const RADAR_COLS = 5;
const RADAR_ROWS = 4;
const FRAME_MS = 700;

function RadarPanel({
  radar,
  lat,
  lng,
  timezone,
}: {
  radar: NonNullable<KioskWeatherFull["radar"]>;
  lat: number;
  lng: number;
  timezone: string;
}) {
  const frames = radar.frames;
  const [frameIdx, setFrameIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const now = useNow(30_000);

  useEffect(() => {
    if (!playing || frames.length < 2) return;
    const t = setInterval(() => setFrameIdx((f) => (f + 1) % frames.length), FRAME_MS);
    return () => clearInterval(t);
  }, [playing, frames.length]);

  const n = 1 << RADAR_ZOOM;
  const clampedLat = Math.max(-85.05, Math.min(85.05, lat));
  const worldX = ((lng + 180) / 360) * n;
  const latRad = (clampedLat * Math.PI) / 180;
  const worldY = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;

  // First tile chosen so the marker sits near the middle of the grid.
  const firstX = Math.round(worldX - RADAR_COLS / 2);
  const firstY = Math.round(worldY - RADAR_ROWS / 2);
  const markerX = ((worldX - firstX) / RADAR_COLS) * 100;
  const markerY = ((worldY - firstY) / RADAR_ROWS) * 100;

  const tiles: { c: number; r: number; x: number; y: number }[] = [];
  for (let r = 0; r < RADAR_ROWS; r++) {
    for (let c = 0; c < RADAR_COLS; c++) {
      tiles.push({
        c,
        r,
        x: (((firstX + c) % n) + n) % n,
        y: Math.max(0, Math.min(n - 1, firstY + r)),
      });
    }
  }

  // Coarser radar tiles covering the same viewport, positioned/scaled onto
  // the z9 grid.
  const scale = 1 << (RADAR_ZOOM - RADAR_OVERLAY_ZOOM);
  const n7 = 1 << RADAR_OVERLAY_ZOOM;
  const radarTiles: { x: number; y: number; left: number; top: number }[] = [];
  for (let y7 = Math.floor(firstY / scale); y7 * scale < firstY + RADAR_ROWS; y7++) {
    for (let x7 = Math.floor(firstX / scale); x7 * scale < firstX + RADAR_COLS; x7++) {
      radarTiles.push({
        x: ((x7 % n7) + n7) % n7,
        y: Math.max(0, Math.min(n7 - 1, y7)),
        left: ((x7 * scale - firstX) / RADAR_COLS) * 100,
        top: ((y7 * scale - firstY) / RADAR_ROWS) * 100,
      });
    }
  }
  const radarTileStyle = (t: { left: number; top: number }) => ({
    left: `${t.left}%`,
    top: `${t.top}%`,
    width: `${(scale / RADAR_COLS) * 100}%`,
    height: `${(scale / RADAR_ROWS) * 100}%`,
  });

  const cur = frames[frameIdx % frames.length];
  const next = frames.length > 1 ? frames[(frameIdx + 1) % frames.length] : null;
  const isForecast = cur.time * 1000 > now.getTime();
  const frameTime = new Date(cur.time * 1000).toLocaleTimeString("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  });

  const tileStyle = (c: number, r: number) => ({
    left: `${(c * 100) / RADAR_COLS}%`,
    top: `${(r * 100) / RADAR_ROWS}%`,
    width: `${100 / RADAR_COLS}%`,
    height: `${100 / RADAR_ROWS}%`,
  });

  return (
    <div className={`p-4 lg:p-5 ${glassPanel}`}>
      <div className="relative w-full overflow-hidden rounded-xl bg-zinc-900 aspect-5/4">
        {/* Base map, dimmed for the dark UI */}
        {tiles.map((t) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`base-${t.c}-${t.r}`}
            src={`https://tile.openstreetmap.org/${RADAR_ZOOM}/${t.x}/${t.y}.png`}
            alt=""
            draggable={false}
            className="absolute brightness-[0.45] contrast-[1.1]"
            style={tileStyle(t.c, t.r)}
          />
        ))}

        {/* Radar overlay for the current frame */}
        {radarTiles.map((t) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`radar-${t.left}-${t.top}`}
            src={`${radar.host}${cur.path}/256/${RADAR_OVERLAY_ZOOM}/${t.x}/${t.y}/2/1_1.png`}
            alt=""
            draggable={false}
            className="absolute opacity-70"
            style={radarTileStyle(t)}
          />
        ))}

        {/* Invisible preload of the next frame so the loop plays smoothly */}
        {next &&
          radarTiles.map((t) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`pre-${t.left}-${t.top}`}
              src={`${radar.host}${next.path}/256/${RADAR_OVERLAY_ZOOM}/${t.x}/${t.y}/2/1_1.png`}
              alt=""
              aria-hidden
              draggable={false}
              className="absolute opacity-0"
              style={radarTileStyle(t)}
            />
          ))}

        {/* House marker at the exact fractional lat/lng position */}
        <div
          className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${markerX}%`, top: `${markerY}%` }}
        >
          <div className="h-4 w-4 rounded-full bg-sky-400 ring-4 ring-sky-400/30" />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          className={`flex h-16 w-16 shrink-0 items-center justify-center text-white ${glassButton}`}
          aria-label={playing ? "Pause radar animation" : "Play radar animation"}
        >
          {playing ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7" />}
        </button>
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-lg font-semibold text-white tabular-nums">
            Radar · {frameTime}
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${
                isForecast ? "bg-amber-400/15 text-amber-300" : "bg-emerald-400/15 text-emerald-300"
              }`}
            >
              {isForecast ? "Forecast" : "Observed"}
            </span>
          </p>
          <p className="mt-0.5 text-xs text-white/40">© OpenStreetMap · Radar by RainViewer</p>
        </div>
        <div className="ml-auto hidden items-center gap-1 sm:flex">
          {frames.map((f, i) => (
            <span
              key={f.time}
              className={`h-1.5 w-1.5 rounded-full ${i === frameIdx % frames.length ? "bg-white" : "bg-white/25"}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
