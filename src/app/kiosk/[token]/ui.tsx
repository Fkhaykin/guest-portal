"use client";

import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";

// Shared building blocks for kiosk screens. Design language: zinc-950 canvas,
// white/10 glass panels, ≥64px touch targets, landscape-first.

export function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function formatShortDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatTime(timeStr: string) {
  const [hours, minutes] = timeStr.split(":");
  const h = parseInt(hours);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${minutes} ${ampm}`;
}

export const glassPanel =
  "rounded-2xl bg-white/[0.07] ring-1 ring-white/10 backdrop-blur-md";
export const glassButton =
  "rounded-2xl bg-white/10 ring-1 ring-white/15 backdrop-blur-md transition-colors hover:bg-white/15 active:scale-[0.98]";

/** Full-screen scaffold for a kiosk sub-screen: sticky glass header with a
 *  big back target, title, live clock; scrollable body below. */
export function KioskScreenShell({
  title,
  subtitle,
  timezone,
  onBack,
  backLabel = "Home",
  children,
  backdrop,
}: {
  title: string;
  subtitle?: string;
  timezone: string;
  onBack: () => void;
  backLabel?: string;
  children: React.ReactNode;
  backdrop?: string;
}) {
  const now = useNow(15_000);
  const clock = now.toLocaleTimeString("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="absolute inset-0 flex flex-col">
      {backdrop && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={backdrop}
          alt=""
          className="absolute inset-0 h-full w-full scale-110 object-cover blur-lg brightness-[0.22]"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/70 via-zinc-950/40 to-zinc-950/80" />

      <div className="relative z-10 flex h-full flex-col">
        <header className="flex items-center gap-5 border-b border-white/10 bg-zinc-950/60 px-5 py-4 backdrop-blur-md lg:px-8 lg:py-5">
          <button
            type="button"
            onClick={onBack}
            className={`flex min-h-16 items-center gap-2 px-6 text-xl font-bold text-white lg:min-h-18 ${glassButton}`}
          >
            <ChevronLeft className="h-7 w-7" />
            {backLabel}
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-extrabold tracking-tight text-white lg:text-3xl">{title}</h1>
            {subtitle && <p className="truncate text-base text-white/60 lg:text-lg">{subtitle}</p>}
          </div>
          <span className="text-xl font-semibold text-white/80 tabular-nums lg:text-2xl">{clock}</span>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </div>
    </div>
  );
}

/** Loading / empty helpers shared by content screens. */
export function KioskSpinner() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
    </div>
  );
}

export function KioskEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <p className="max-w-md text-center text-lg text-white/50">{message}</p>
    </div>
  );
}
