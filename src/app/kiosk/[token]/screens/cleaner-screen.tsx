"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Dog, PawPrint, Sparkles, Users } from "lucide-react";
import type { KioskData } from "../types";
import { useNow } from "../ui";

const SLIDE_MS = 12000;

function nightsBetween(checkIn: string, checkOut: string): number {
  return Math.round(
    (new Date(`${checkOut}T00:00:00Z`).getTime() - new Date(`${checkIn}T00:00:00Z`).getTime()) /
      86400000
  );
}

function arrivalLabel(dateStr: string, today: string): string {
  const long = new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const days = nightsBetween(today, dateStr);
  if (days === 0) return `today — ${long}`;
  if (days === 1) return `tomorrow — ${long}`;
  return `${long} (in ${days} days)`;
}

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

  const todayW = data.weather?.find((w) => w.date === data.today) ?? data.weather?.[0];
  const next = data.next_booking;

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
      <div className="absolute inset-0 bg-zinc-950/75" />

      {/* Top strip: property name + tappable weather */}
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-6 p-8 lg:p-12">
        <span className="max-w-[50%] text-sm font-semibold uppercase tracking-[0.35em] text-white/70">
          {data.property.name}
        </span>
        {todayW && (
          <button
            type="button"
            onPointerDown={onWeather}
            className="flex items-center gap-3 rounded-full bg-white/10 px-5 py-2.5 text-lg font-medium text-white/90 backdrop-blur-md"
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

      {/* Center: cleaner greeting + next arrival */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-8 px-8 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white/10 backdrop-blur-md">
          <Sparkles className="h-8 w-8 text-amber-300" />
        </span>
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-white text-balance lg:text-5xl">
            Thanks for getting the house ready!
          </h1>
          <p className="mt-3 text-xl text-white/60 lg:text-2xl">
            No guests are checked in right now.
          </p>
        </div>

        <div className="w-full max-w-xl rounded-3xl bg-white/10 p-8 text-left backdrop-blur-md ring-1 ring-white/15">
          {next ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/50">
                Next arrival
              </p>
              <p className="mt-3 flex items-center gap-3 text-2xl font-semibold text-white lg:text-3xl">
                <CalendarDays className="h-7 w-7 shrink-0 text-white/60" />
                {next.first_name ? `${next.first_name} arrives ` : "Guests arrive "}
                {arrivalLabel(next.check_in_date, data.today)}
              </p>
              <div className="mt-5 flex flex-wrap gap-3 text-lg text-white/90">
                {next.num_guests != null && (
                  <span className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2">
                    <Users className="h-5 w-5 text-white/60" />
                    {next.num_guests} {next.num_guests === 1 ? "guest" : "guests"}
                  </span>
                )}
                <span className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2">
                  <CalendarDays className="h-5 w-5 text-white/60" />
                  {nightsBetween(next.check_in_date, next.check_out_date)}{" "}
                  {nightsBetween(next.check_in_date, next.check_out_date) === 1 ? "night" : "nights"}
                </span>
                <span className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2">
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
            </>
          ) : (
            <p className="text-xl text-white/80">
              No upcoming arrivals on the calendar yet.
            </p>
          )}
        </div>

        <p className="max-w-md text-sm text-white/50">
          This screen switches to the guest welcome automatically on arrival day.
          {data.property.host_phone ? ` Questions? Call ${data.property.host_phone}.` : ""}
        </p>
      </div>

      {/* Bottom-left clock, mirroring the attract screen */}
      <div className="absolute inset-x-0 bottom-0 p-8 lg:p-12">
        <p className="text-5xl font-bold leading-none tracking-tight text-white tabular-nums lg:text-6xl">
          {time}
        </p>
        <p className="mt-2 text-lg font-medium text-white/70 lg:text-xl">{date}</p>
      </div>
    </div>
  );
}
