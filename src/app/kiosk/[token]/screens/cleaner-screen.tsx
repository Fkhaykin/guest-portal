"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  CalendarDays,
  CalendarRange,
  ChevronRight,
  CloudSun,
  Dog,
  Droplets,
  PawPrint,
  Sparkles,
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

function longDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function monthDay(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function weekdayShort(dateStr: string, today: string): string {
  if (dateStr === today) return "Today";
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", { weekday: "short" });
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
      className={`flex flex-col rounded-3xl bg-white/10 p-7 ring-1 ring-white/15 backdrop-blur-xl shadow-2xl shadow-black/25 ${className}`}
    >
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white/80">
          {icon}
        </span>
        <span className="text-sm font-semibold uppercase tracking-[0.3em] text-white/60">{title}</span>
      </div>
      {children}
    </div>
  );
}

const chip = "flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-lg text-white/90";

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
  const laterStays = upcoming.slice(1, 4); // calendar rows beyond the next arrival

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
        <div className="flex items-center gap-4 text-center">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md">
            <Sparkles className="h-7 w-7 text-amber-300" />
          </span>
          <div className="text-left">
            <h1 className="text-4xl font-bold tracking-tight text-white lg:text-5xl">
              Hi{data.cleaner_name ? ` ${data.cleaner_name}` : " there"}!
            </h1>
            <p className="mt-1 text-lg text-white/70 lg:text-xl">
              Thanks for getting the house ready. Here&apos;s what&apos;s coming up.
            </p>
          </div>
        </div>

        <div className="grid w-full max-w-6xl gap-6 lg:grid-cols-3">
          {/* Widget 1 — next arrival / guest details */}
          <Widget icon={<UserRound className="h-5 w-5" />} title="Next arrival">
            {next ? (
              <div className="flex flex-1 flex-col">
                <p className="text-3xl font-bold text-white lg:text-4xl">
                  {next.first_name ? `${next.first_name}'s party` : "Incoming guests"}
                </p>
                <p className="mt-2 text-lg text-white/70">
                  {next.check_in_time} · {longDate(next.check_in_date)}
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  {next.num_guests != null && (
                    <span className={chip}>
                      <Users className="h-5 w-5 text-white/60" />
                      {next.num_guests} {next.num_guests === 1 ? "guest" : "guests"}
                    </span>
                  )}
                  <span className={chip}>
                    <CalendarDays className="h-5 w-5 text-white/60" />
                    {nightsBetween(next.check_in_date, next.check_out_date)}{" "}
                    {nightsBetween(next.check_in_date, next.check_out_date) === 1 ? "night" : "nights"}
                  </span>
                  <span className={chip}>
                    {next.pets > 0 ? (
                      <>
                        <Dog className="h-5 w-5 text-white/60" />
                        {next.pets} {next.pets === 1 ? "pet" : "pets"}
                      </>
                    ) : (
                      <>
                        <PawPrint className="h-5 w-5 text-white/60" />
                        No pets
                      </>
                    )}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-lg text-white/70">No upcoming check-ins scheduled yet.</p>
            )}
          </Widget>

          {/* Widget 2 — weather with detail */}
          <Widget icon={<CloudSun className="h-5 w-5" />} title="Weather">
            {todayW ? (
              <div className="flex flex-1 flex-col">
                <div className="flex items-center gap-4">
                  <span className="text-6xl leading-none">{todayW.emoji}</span>
                  <div>
                    <p className="text-5xl font-bold leading-none tracking-tight text-white tabular-nums">
                      {todayW.tempMaxF != null ? `${Math.round(todayW.tempMaxF)}°` : "—"}
                    </p>
                    <p className="mt-1 text-lg text-white/70">{todayW.label}</p>
                  </div>
                </div>
                {todayW.precipProb != null && (
                  <p className="mt-3 flex items-center gap-2 text-base text-white/60">
                    <Droplets className="h-4 w-4" />
                    {Math.round(todayW.precipProb)}% chance of rain today
                  </p>
                )}
                {forecast.length > 0 && (
                  <div className="mt-5 grid grid-cols-4 gap-2 border-t border-white/10 pt-4">
                    {forecast.map((w) => (
                      <div key={w.date} className="flex flex-col items-center gap-1 text-center">
                        <span className="text-xs font-semibold uppercase tracking-wide text-white/50">
                          {weekdayShort(w.date, data.today)}
                        </span>
                        <span className="text-2xl">{w.emoji}</span>
                        <span className="text-base font-semibold text-white tabular-nums">
                          {w.tempMaxF != null ? `${Math.round(w.tempMaxF)}°` : "—"}
                        </span>
                        {w.precipProb != null && w.precipProb >= 15 && (
                          <span className="text-xs text-sky-300/80 tabular-nums">
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
                  className="mt-5 inline-flex items-center gap-1 self-start text-base font-semibold text-white/70"
                >
                  Full forecast <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <p className="text-lg text-white/70">Forecast unavailable right now.</p>
            )}
          </Widget>

          {/* Widget 3 — calendar of upcoming stays */}
          <Widget icon={<CalendarRange className="h-5 w-5" />} title="Booking calendar">
            {upcoming.length > 0 ? (
              <ul className="flex flex-1 flex-col gap-2">
                {upcoming.slice(0, 4).map((b, i) => (
                  <CalendarRow key={`${b.check_in_date}-${i}`} booking={b} highlight={i === 0} />
                ))}
                {upcoming.length > 4 && (
                  <li className="pt-1 text-center text-sm text-white/50">
                    +{upcoming.length - 4} more upcoming
                  </li>
                )}
              </ul>
            ) : (
              <p className="text-lg text-white/70">No upcoming stays on the calendar.</p>
            )}
            {/* keeps the card visually balanced when only one stay exists */}
            {laterStays.length === 0 && upcoming.length === 1 && (
              <p className="mt-auto pt-4 text-sm text-white/45">
                The house is open after this stay.
              </p>
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

function CalendarRow({ booking, highlight }: { booking: KioskNextBooking; highlight: boolean }) {
  const nights = nightsBetween(booking.check_in_date, booking.check_out_date);
  return (
    <li
      className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${
        highlight ? "bg-white/15 ring-1 ring-white/20" : "bg-white/5"
      }`}
    >
      <div className="flex min-w-16 flex-col items-center rounded-xl bg-white/10 px-3 py-1.5 text-center">
        <span className="text-lg font-bold leading-tight text-white tabular-nums">
          {monthDay(booking.check_in_date)}
        </span>
        <span className="text-[0.65rem] uppercase tracking-wide text-white/50">
          {nights}n
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg font-semibold text-white">
          {booking.first_name ? `${booking.first_name}'s party` : "Guest stay"}
        </p>
        <p className="text-sm text-white/60">
          {monthDay(booking.check_in_date)} – {monthDay(booking.check_out_date)}
          {booking.num_guests != null ? ` · ${booking.num_guests} guests` : ""}
        </p>
      </div>
    </li>
  );
}
