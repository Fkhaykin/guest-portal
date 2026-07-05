"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AttractScreen } from "./attract-screen";
import { MainScreen } from "./main-screen";

const SESSION_KEY = "guest-portal-session";
const TOKEN_KEY = "guest-portal-token";
const KIOSK_RETURN_KEY = "kiosk-return-url";

const REFETCH_MS = 15 * 60 * 1000;
const MAIN_IDLE_MS = 60 * 1000; // main screen → attract after a minute untouched
const RELOAD_HOUR = 4; // nightly self-reload picks up deploys, clears leaks

export interface KioskWeatherDay {
  date: string;
  tempMaxF: number | null;
  precipProb: number | null;
  label: string;
  emoji: string;
}

export interface KioskBooking {
  first_name: string;
  guest_name: string | null;
  guest_token: string;
  reservation: {
    id: string;
    check_in_date: string;
    check_out_date: string;
    num_guests: number | null;
    signature_url: string | null;
    booking_source: string | null;
    property: { slug: string; name: string };
    lodgify: { check_in_time: string | null; check_out_time: string | null } | null;
  } & Record<string, unknown>;
}

export interface KioskData {
  property: { id: string; name: string; slug: string; address: string | null; timezone: string };
  today: string;
  state: "arrival_day" | "mid_stay" | "checkout_day" | "none";
  photos: string[];
  weather: KioskWeatherDay[] | null;
  booking: KioskBooking | null;
}

export function KioskClient({ token }: { token: string }) {
  const [data, setData] = useState<KioskData | null>(null);
  const [failed, setFailed] = useState(false);
  const [phase, setPhase] = useState<"attract" | "main">("attract");
  const [exited, setExited] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const search = process.env.NODE_ENV === "development" ? window.location.search : "";
      const res = await fetch(`/api/kiosk/${token}${search}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setData(await res.json());
      setFailed(false);
    } catch {
      // Keep showing the last good payload; only surface an error with nothing to show
      setFailed(true);
    }
  }, [token]);

  // Kiosk-mode flag: lets IdleReturnGate bring any portal page back here.
  // ?exit=1 is the escape hatch for a personal device that opened this URL;
  // ?preview=1 (admin preview) never sets the flag in the first place.
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    if (search.get("exit") === "1") {
      localStorage.removeItem(KIOSK_RETURN_KEY);
      setExited(true);
      return;
    }
    if (search.get("preview") === "1") return;
    localStorage.setItem(KIOSK_RETURN_KEY, `/kiosk/${token}`);
  }, [token]);

  // Fetch now, on an interval, and whenever the display wakes up.
  useEffect(() => {
    if (exited) return;
    load();
    const interval = setInterval(load, REFETCH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load, exited]);

  // Nightly reload at 4 AM local (pairs with the device's scheduled reboot).
  useEffect(() => {
    const now = new Date();
    const next = new Date(now);
    next.setHours(RELOAD_HOUR, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    const t = setTimeout(() => window.location.reload(), next.getTime() - now.getTime());
    return () => clearTimeout(t);
  }, []);

  // Main screen idles back to the attract loop.
  useEffect(() => {
    if (phase !== "main") return;
    const arm = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => setPhase("attract"), MAIN_IDLE_MS);
    };
    arm();
    window.addEventListener("pointerdown", arm, { passive: true });
    window.addEventListener("scroll", arm, { passive: true });
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      window.removeEventListener("pointerdown", arm);
      window.removeEventListener("scroll", arm);
    };
  }, [phase]);

  // Hand off into the guest portal exactly like checkin's saveSession():
  // seed the session + token for the current booking, scrub them when vacant.
  const handoff = useCallback(
    (href: string) => {
      if (!data) return;
      try {
        if (data.booking) {
          sessionStorage.setItem(
            SESSION_KEY,
            JSON.stringify({ guestName: data.booking.guest_name, reservation: data.booking.reservation })
          );
          sessionStorage.setItem(TOKEN_KEY, data.booking.guest_token);
        } else {
          sessionStorage.removeItem(SESSION_KEY);
          sessionStorage.removeItem(TOKEN_KEY);
        }
      } catch {
        // Storage unavailable — portal pages fall back to their own lookups
      }
      window.location.assign(href);
    },
    [data]
  );

  if (exited) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950 text-zinc-100 font-(family-name:--font-plus-jakarta)">
        <p className="max-w-sm text-center text-lg text-zinc-400">
          Kiosk mode is off for this device. You can close this tab.
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-zinc-950 text-zinc-100 font-(family-name:--font-plus-jakarta)">
        {failed ? (
          <p className="text-lg text-zinc-400">Reconnecting…</p>
        ) : (
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-100" />
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 select-none overflow-hidden bg-zinc-950 text-zinc-50 font-(family-name:--font-plus-jakarta)">
      {phase === "attract" ? (
        <AttractScreen data={data} onWake={() => setPhase("main")} />
      ) : (
        <MainScreen data={data} onHandoff={handoff} />
      )}
    </div>
  );
}
