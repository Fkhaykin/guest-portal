"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowRightLeft,
  CalendarRange,
  ChevronRight,
  CloudSun,
  Dog,
  Droplets,
  LogIn,
  LogOut,
  PawPrint,
  UserRound,
  Users,
} from "lucide-react";
import type { KioskData, KioskNextBooking } from "../types";
import { useNow } from "../ui";

const SLIDE_MS = 12000;

function nightsBetween(checkIn: string, checkOut: string): number {
  return Math.round(
    (new Date(`${checkOut}T00:00:00Z`).getTime() - new Date(`${checkIn}T00:00:00Z`).getTime()) /
      86400000
  );
}

function monthDay(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function weekdayShort(dateStr: string, today: string): string {
  if (dateStr === today) return "Today";
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", { weekday: "short" });
}

// "4:00 PM" → { h: 16, min: 0 }
function parseTimeLabel(label: string): { h: number; min: number } {
  const m = label.match(/(\d{1,2}):(\d{2})\s*([AP]M)/i);
  if (!m) return { h: 16, min: 0 };
  let h = parseInt(m[1], 10) % 12;
  if (m[3].toUpperCase() === "PM") h += 12;
  return { h, min: parseInt(m[2], 10) };
}

// The kiosk device sits in the property's timezone, so a plain local Date built
// from the wall-clock arrival is the right instant.
function arrivalInstant(dateStr: string, timeLabel: string): Date {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const { h, min } = parseTimeLabel(timeLabel);
  return new Date(y, mo - 1, d, h, min, 0, 0);
}

// Two largest non-zero units of the remaining time, e.g. [{2,"d"},{4,"h"}].
function countdownSegments(target: Date, now: Date): { value: number; unit: string }[] | null {
  const ms = target.getTime() - now.getTime();
  if (ms <= 0) return null;
  const totalMin = Math.floor(ms / 60000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  if (days > 0) return [{ value: days, unit: "d" }, { value: hours, unit: "h" }];
  if (hours > 0) return [{ value: hours, unit: "h" }, { value: mins, unit: "m" }];
  return [{ value: Math.max(mins, 1), unit: "m" }];
}

// Shared glass card — one look across every widget.
function Widget({
  icon,
  title,
  children,
  className = "",
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col rounded-3xl bg-white/10 p-6 ring-1 ring-white/15 backdrop-blur-xl shadow-2xl shadow-black/25 ${className}`}
    >
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white/80">
          {icon}
        </span>
        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">{title}</span>
      </div>
      {children}
    </div>
  );
}

const smallChip = "flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm text-white/90";

// Vacant-house takeover. While no guest is checked in, the kiosk greets the
// turnover crew instead of exposing the guest app; the only touch target is
// the weather. It flips back to the guest experience on its own once a
// booking becomes current.
export function CleanerScreen({
  data,
  onWeather,
}: {
  data: KioskData;
  onWeather: () => void;
}) {
  const now = useNow(1000);
  const [slide, setSlide] = useState(0);
  const photos = data.photos;

  useEffect(() => {
    if (photos.length < 2) return;
    const t = setInterval(() => setSlide((s) => (s + 1) % photos.length), SLIDE_MS);
    return () => clearInterval(t);
  }, [photos.length]);

  const tz = data.property.timezone;
  const time = now.toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" });
  const date = now.toLocaleDateString("en-US", { timeZone: tz, weekday: "long", month: "long", day: "numeric" });

  const weather = data.weather ?? [];
  const todayW = weather.find((w) => w.date === data.today) ?? weather[0] ?? null;
  const forecast = weather.filter((w) => w.date !== todayW?.date).slice(0, 4);
  const next = data.next_booking;
  const upcoming = data.upcoming_bookings ?? [];
  const shown = upcoming.slice(0, 4);

  const countdown = next ? countdownSegments(arrivalInstant(next.check_in_date, next.check_in_time), now) : null;

  return (
    <div className="absolute inset-0 h-full w-full">
      {/* Slideshow backdrop, same treatment as the attract screen */}
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
            <img src={src} alt="" className="h-full w-full object-cover" />
          </div>
        );
      })}
      <div className="absolute inset-0 bg-zinc-950/80" />

      {/* Top strip: property name + tappable weather */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-6 p-8 lg:p-10">
        <span className="max-w-[50%] text-sm font-semibold uppercase tracking-[0.35em] text-white/70">
          {data.property.name}
        </span>
        {todayW && (
          <button
            type="button"
            onPointerDown={onWeather}
            className="flex items-center gap-3 rounded-full bg-white/10 px-5 py-2.5 text-lg font-medium text-white/90 ring-1 ring-white/15 backdrop-blur-md"
            aria-label="Open the full weather forecast"
          >
            <span className="text-2xl">{todayW.emoji}</span>
            {todayW.tempMaxF != null && (
              <span className="tabular-nums">{Math.round(todayW.tempMaxF)}°</span>
            )}
            <span className="text-white/70">{todayW.label}</span>
          </button>
        )}
      </div>

      {/* Content: greeting + widget grid, scroll-safe on short displays */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-8 overflow-y-auto px-8 py-24 lg:px-12">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-white lg:text-5xl">
            Hi{data.cleaner_name ? ` ${data.cleaner_name}` : " there"}!
          </h1>
          <p className="mt-1.5 text-lg text-white/70 lg:text-xl">
            Thanks for getting the house ready. Here&apos;s what&apos;s coming up.
          </p>
        </div>

        <div className="grid w-full max-w-6xl items-start gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          {/* Left column: compact next-arrival + weather */}
          <div className="flex flex-col gap-6">
            {/* Widget 1 — next arrival, countdown-forward */}
            <Widget icon={<UserRound className="h-5 w-5" />} title="Next arrival">
              {next ? (
                <>
                  {countdown ? (
                    <div className="flex items-baseline gap-2">
                      {countdown.map((seg) => (
                        <span
                          key={seg.unit}
                          className="text-6xl font-bold leading-none tracking-tight text-white tabular-nums lg:text-7xl"
                        >
                          {seg.value}
                          <span className="text-3xl font-semibold text-white/60 lg:text-4xl">{seg.unit}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-4xl font-bold leading-none tracking-tight text-white lg:text-5xl">
                      Arriving now
                    </p>
                  )}
                  <p className="mt-2 text-sm font-semibold uppercase tracking-[0.2em] text-white/50">
                    till guest arrival
                  </p>

                  <div className="mt-4 border-t border-white/10 pt-4">
                    <p className="text-xl font-bold text-white">
                      {next.first_name ? `${next.first_name}'s party` : "Incoming guests"}
                    </p>
                    <p className="mt-0.5 text-sm text-white/60">
                      {next.check_in_time} · {weekdayShort(next.check_in_date, data.today)}{" "}
                      {monthDay(next.check_in_date)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {next.num_guests != null && (
                        <span className={smallChip}>
                          <Users className="h-4 w-4 text-white/60" />
                          {next.num_guests}
                        </span>
                      )}
                      <span className={smallChip}>
                        {nightsBetween(next.check_in_date, next.check_out_date)}n
                      </span>
                      <span className={smallChip}>
                        {next.pets > 0 ? (
                          <>
                            <Dog className="h-4 w-4 text-white/60" />
                            {next.pets}
                          </>
                        ) : (
                          <>
                            <PawPrint className="h-4 w-4 text-white/60" />
                            No pets
                          </>
                        )}
                      </span>
                      {next.has_early_checkin && (
                        <span className="flex items-center gap-1.5 rounded-full bg-sky-500/20 px-3 py-1.5 text-sm font-medium text-sky-200 ring-1 ring-sky-400/25">
                          <LogIn className="h-4 w-4" />
                          Early check-in
                        </span>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-lg text-white/70">No upcoming check-ins scheduled yet.</p>
              )}
            </Widget>

            {/* Widget 2 — weather, compact but full detail */}
            <Widget icon={<CloudSun className="h-5 w-5" />} title="Weather">
              {todayW ? (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-4xl leading-none">{todayW.emoji}</span>
                      <div>
                        <p className="text-3xl font-bold leading-none tracking-tight text-white tabular-nums">
                          {todayW.tempMaxF != null ? `${Math.round(todayW.tempMaxF)}°` : "—"}
                        </p>
                        <p className="text-sm text-white/70">{todayW.label}</p>
                      </div>
                    </div>
                    {todayW.precipProb != null && (
                      <span className="flex items-center gap-1 text-sm text-white/60">
                        <Droplets className="h-3.5 w-3.5" />
                        {Math.round(todayW.precipProb)}%
                      </span>
                    )}
                  </div>
                  {forecast.length > 0 && (
                    <div className="mt-4 grid grid-cols-4 gap-1 border-t border-white/10 pt-3">
                      {forecast.map((w) => (
                        <div key={w.date} className="flex flex-col items-center gap-0.5 text-center">
                          <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-white/50">
                            {weekdayShort(w.date, data.today)}
                          </span>
                          <span className="text-xl">{w.emoji}</span>
                          <span className="text-sm font-semibold text-white tabular-nums">
                            {w.tempMaxF != null ? `${Math.round(w.tempMaxF)}°` : "—"}
                          </span>
                          {w.precipProb != null && w.precipProb >= 15 && (
                            <span className="text-[0.65rem] text-sky-300/80 tabular-nums">
                              {Math.round(w.precipProb)}%
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onPointerDown={onWeather}
                    className="mt-3 inline-flex items-center gap-1 self-start text-sm font-semibold text-white/60"
                  >
                    Full forecast <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <p className="text-sm text-white/70">Forecast unavailable right now.</p>
              )}
            </Widget>
          </div>

          {/* Widget 3 — booking calendar with turnover highlights */}
          <Widget icon={<CalendarRange className="h-5 w-5" />} title="Booking calendar">
            {upcoming.length > 0 ? (
              <ul className="flex flex-col gap-2.5">
                {shown.map((b, i) => {
                  const prev = shown[i - 1];
                  const nextB = shown[i + 1];
                  const backToBack =
                    (!!prev && prev.check_out_date === b.check_in_date) ||
                    (!!nextB && b.check_out_date === nextB.check_in_date);
                  return (
                    <CalendarRow
                      key={`${b.check_in_date}-${i}`}
                      booking={b}
                      highlight={i === 0}
                      backToBack={backToBack}
                    />
                  );
                })}
                {upcoming.length > shown.length ? (
                  <li className="pt-1 text-center text-sm text-white/50">
                    +{upcoming.length - shown.length} more upcoming
                  </li>
                ) : (
                  <li className="flex items-center gap-2 px-1 pt-1 text-sm text-white/45">
                    <span className="h-px flex-1 bg-white/10" />
                    The house is open after {shown.length > 1 ? "these stays" : "this stay"}
                    <span className="h-px flex-1 bg-white/10" />
                  </li>
                )}
              </ul>
            ) : (
              <p className="text-lg text-white/70">No upcoming stays on the calendar.</p>
            )}
          </Widget>
        </div>

        <p className="max-w-lg text-center text-sm text-white/50">
          This screen switches to the guest welcome automatically at check-in.
          {data.property.host_phone ? ` Questions? Call ${data.property.host_phone}.` : ""}
        </p>
      </div>

      {/* Bottom-left clock, mirroring the attract screen */}
      <div className="pointer-events-none absolute bottom-0 left-0 z-10 p-8 lg:p-10">
        <p className="text-4xl font-bold leading-none tracking-tight text-white tabular-nums lg:text-5xl">
          {time}
        </p>
        <p className="mt-2 text-base font-medium text-white/70 lg:text-lg">{date}</p>
      </div>
    </div>
  );
}

const badge = "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1";

function CalendarRow({
  booking,
  highlight,
  backToBack,
}: {
  booking: KioskNextBooking;
  highlight: boolean;
  backToBack: boolean;
}) {
  const nights = nightsBetween(booking.check_in_date, booking.check_out_date);
  return (
    <li
      className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${
        backToBack
          ? "bg-amber-500/15 ring-1 ring-amber-400/40"
          : highlight
            ? "bg-white/15 ring-1 ring-white/20"
            : "bg-white/5"
      }`}
    >
      <div className="flex min-w-16 flex-col items-center rounded-xl bg-white/10 px-3 py-1.5 text-center">
        <span className="text-lg font-bold leading-tight text-white tabular-nums">
          {monthDay(booking.check_in_date)}
        </span>
        <span className="text-[0.65rem] uppercase tracking-wide text-white/50">{nights}n</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg font-semibold text-white">
          {booking.first_name ? `${booking.first_name}'s party` : "Guest stay"}
        </p>
        <p className="text-sm text-white/60">
          {monthDay(booking.check_in_date)} – {monthDay(booking.check_out_date)}
          {booking.num_guests != null ? ` · ${booking.num_guests} guests` : ""}
        </p>
        {(backToBack || booking.has_early_checkin || booking.has_late_checkout) && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {backToBack && (
              <span className={`${badge} bg-amber-500/25 text-amber-100 ring-amber-400/40`}>
                <ArrowRightLeft className="h-3 w-3" />
                Back-to-back
              </span>
            )}
            {booking.has_early_checkin && (
              <span className={`${badge} bg-sky-500/20 text-sky-100 ring-sky-400/30`}>
                <LogIn className="h-3 w-3" />
                Early check-in {booking.check_in_time}
              </span>
            )}
            {booking.has_late_checkout && (
              <span className={`${badge} bg-violet-500/20 text-violet-100 ring-violet-400/30`}>
                <LogOut className="h-3 w-3" />
                Late check-out {booking.check_out_time}
              </span>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
