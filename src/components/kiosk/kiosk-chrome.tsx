"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { House } from "lucide-react";
import { useProperty } from "@/hooks/use-property";

const KIOSK_RETURN_KEY = "kiosk-return-url";

// Same client-only gating pattern as LiveChatGate: server snapshot renders
// nothing, the client snapshot reads the kiosk flag after hydration.
const subscribe = () => () => {};
const getReturnUrlSnapshot = () => {
  try {
    return localStorage.getItem(KIOSK_RETURN_KEY);
  } catch {
    return null;
  }
};
const getServerSnapshot = () => null;

/** Kiosk frame for portal pages (register, add-ons, …) opened from the
 *  in-house kiosk. Self-gating on the same localStorage flag IdleReturnGate
 *  uses: normal visitors never see it. When active it adds `kiosk-mode` to
 *  <html> — globals.css then hides the regular PropertyHeader/GuestNav — and
 *  renders a dark top bar with a big "Kiosk Home" target instead. */
export function KioskChromeGate() {
  const property = useProperty();
  const returnUrl = useSyncExternalStore(subscribe, getReturnUrlSnapshot, getServerSnapshot);
  const [clock, setClock] = useState("");
  const { setTheme } = useTheme();

  useEffect(() => {
    if (!returnUrl) return;
    document.documentElement.classList.add("kiosk-mode");
    // Kiosk devices render the portal pages in dark to match the kiosk shell.
    // setTheme (not a raw class) so next-themes doesn't strip it on re-apply;
    // it persists per-device, which is exactly right for a wall tablet.
    setTheme("dark");
    return () => document.documentElement.classList.remove("kiosk-mode");
  }, [returnUrl, setTheme]);

  useEffect(() => {
    if (!returnUrl) return;
    const tz = property?.timezone || "America/New_York";
    const tick = () =>
      setClock(new Date().toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }));
    const t = setInterval(tick, 15_000);
    tick();
    return () => clearInterval(t);
  }, [returnUrl, property?.timezone]);

  if (!returnUrl) return null;

  return (
    <div className="sticky top-0 z-[60] flex items-center gap-4 border-b border-white/10 bg-zinc-950 px-4 py-3 text-white sm:px-6">
      <button
        type="button"
        onClick={() => window.location.assign(returnUrl)}
        className="flex min-h-12 items-center gap-2 rounded-xl bg-white/10 px-5 text-base font-semibold ring-1 ring-white/15 transition-colors hover:bg-white/15 active:scale-[0.98]"
      >
        <House className="h-5 w-5" />
        Kiosk Home
      </button>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold uppercase tracking-[0.25em] text-white/60">
        {property?.name}
      </span>
      <span className="text-sm font-semibold text-white/80 tabular-nums">{clock}</span>
    </div>
  );
}
