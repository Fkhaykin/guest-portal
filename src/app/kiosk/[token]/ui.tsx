"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { ChevronLeft, Moon, Sun, SunMoon } from "lucide-react";

// Shared building blocks for kiosk screens. Neutral colors come from the
// --k-* theme variables (globals.css) so the whole kiosk flips light/dark.

export type KioskTheme = "dark" | "light";
// `mode` is the persisted preference; `theme` is what's actually shown. In
// "auto" the theme tracks the house's local time of day (see kiosk-client).
export type KioskThemeMode = "auto" | "light" | "dark";
export const KioskThemeContext = createContext<{
  theme: KioskTheme;
  mode: KioskThemeMode;
  toggle: () => void;
}>({
  theme: "dark",
  mode: "auto",
  toggle: () => {},
});
export function useKioskTheme() {
  return useContext(KioskThemeContext);
}

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
  "rounded-2xl bg-(--k-surf-07) ring-1 ring-(--k-surf-10) backdrop-blur-md";
export const glassButton =
  "rounded-2xl bg-(--k-surf-10) ring-1 ring-(--k-surf-15) backdrop-blur-md transition-colors hover:bg-(--k-surf-15) active:scale-[0.98]";

/** Theme cycle — Auto (follows the house's local time) → Light → Dark → Auto.
 *  Icon shows the current mode: SunMoon = auto, Sun = light, Moon = dark. */
export function KioskThemeToggle({ className = "" }: { className?: string }) {
  const { mode, toggle } = useKioskTheme();
  const next: KioskThemeMode = mode === "auto" ? "light" : mode === "light" ? "dark" : "auto";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Theme: ${mode}. Tap for ${next} mode.`}
      className={`flex h-12 w-12 items-center justify-center text-(--k-fg) ${glassButton} ${className}`}
    >
      {mode === "auto" ? (
        <SunMoon className="h-6 w-6" />
      ) : mode === "light" ? (
        <Sun className="h-6 w-6" />
      ) : (
        <Moon className="h-6 w-6" />
      )}
    </button>
  );
}

/** Full-screen scaffold for a kiosk sub-screen: sticky header with a big back
 *  target, title, theme toggle, live clock; scrollable body below. */
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
  const { theme } = useKioskTheme();
  const now = useNow(15_000);
  const clock = now.toLocaleTimeString("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="absolute inset-0 flex flex-col bg-(--k-bg)">
      {/* Photo backdrop + dark scrim only in dark mode; light mode is a clean canvas */}
      {theme === "dark" && (
        <>
          {backdrop && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={backdrop}
              alt=""
              className="absolute inset-0 h-full w-full scale-110 object-cover blur-lg brightness-[0.22]"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/70 via-zinc-950/40 to-zinc-950/80" />
        </>
      )}

      <div className="relative z-10 flex h-full flex-col">
        <header className="flex items-center gap-5 border-b border-(--k-surf-10) bg-(--k-bg) px-5 py-4 lg:px-8 lg:py-5">
          <button
            type="button"
            onClick={onBack}
            className={`flex min-h-16 items-center gap-2 px-6 text-xl font-bold text-(--k-fg) lg:min-h-18 ${glassButton}`}
          >
            <ChevronLeft className="h-7 w-7" />
            {backLabel}
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-extrabold tracking-tight text-(--k-fg) lg:text-3xl">{title}</h1>
            {subtitle && <p className="truncate text-base text-(--k-fg-60) lg:text-lg">{subtitle}</p>}
          </div>
          <KioskThemeToggle />
          <span className="text-xl font-semibold text-(--k-fg-80) tabular-nums lg:text-2xl">{clock}</span>
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
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-(--k-surf-20) border-t-(--k-fg)" />
    </div>
  );
}

export function KioskEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <p className="max-w-md text-center text-lg text-(--k-fg-50)">{message}</p>
    </div>
  );
}
