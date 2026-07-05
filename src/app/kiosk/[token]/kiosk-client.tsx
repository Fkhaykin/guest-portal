"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import type { KioskContent, KioskData, KioskScreen } from "./types";
import { AttractScreen } from "./attract-screen";
import { MainScreen } from "./main-screen";
import { WeatherScreen } from "./screens/weather-screen";
import { RulesScreen } from "./screens/rules-screen";
import { FaqScreen } from "./screens/faq-screen";
import { VideosScreen } from "./screens/videos-screen";
import { VideoPlayerScreen } from "./screens/video-player-screen";
import { ServicesScreen } from "./screens/services-screen";
import { PromosScreen } from "./screens/promos-screen";
import { ExploreScreen } from "./screens/explore-screen";

const SESSION_KEY = "guest-portal-session";
const TOKEN_KEY = "guest-portal-token";
const KIOSK_RETURN_KEY = "kiosk-return-url";

const REFETCH_MS = 15 * 60 * 1000;
const IDLE_MS = 90 * 1000; // any screen → attract after 90s untouched
const VIDEO_IDLE_MS = 30 * 60 * 1000; // don't idle out mid-video
const NOTICE_MS = 12 * 1000;
const RELOAD_HOUR = 4; // nightly self-reload picks up deploys, clears leaks

export function KioskClient({ token }: { token: string }) {
  const [data, setData] = useState<KioskData | null>(null);
  const [content, setContent] = useState<KioskContent | null>(null);
  const [contentFailed, setContentFailed] = useState(false);
  const [failed, setFailed] = useState(false);
  const [screen, setScreen] = useState<KioskScreen>({ kind: "attract" });
  const [exited, setExited] = useState(false);
  const [notice, setNotice] = useState<"success" | "cancelled" | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const search = process.env.NODE_ENV === "development" ? window.location.search : "";
      const [mainRes, contentRes] = await Promise.all([
        fetch(`/api/kiosk/${token}${search}`, { cache: "no-store" }),
        fetch(`/api/kiosk/${token}/content`, { cache: "no-store" }),
      ]);
      if (!mainRes.ok) throw new Error(String(mainRes.status));
      setData(await mainRes.json());
      if (contentRes.ok) {
        setContent(await contentRes.json());
        setContentFailed(false);
      } else {
        // Content screens show an error instead of an endless spinner; the
        // 15-minute refetch (and any wake) retries.
        setContentFailed(true);
      }
      setFailed(false);
    } catch {
      // Keep showing the last good payload; only surface an error with nothing to show
      setFailed(true);
    }
  }, [token]);

  // Kiosk-mode flag: lets IdleReturnGate + KioskChromeGate work on portal
  // pages. ?exit=1 is the escape hatch for a personal device that opened this
  // URL; ?preview=1 (admin preview) never sets the flag in the first place.
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

  // Stripe return from a kiosk service purchase. The URL cleanup makes this
  // non-idempotent, so the dismiss timer lives in its own effect below —
  // under a double mount (StrictMode) the re-run early-returns and a timer
  // armed here would have been cleared, leaving the banner stuck.
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const success = search.get("service_success") === "1";
    const cancelled = search.get("service_cancelled") === "1";
    if (!success && !cancelled) return;
    setNotice(success ? "success" : "cancelled");
    setScreen({ kind: "home" });
    search.delete("service_success");
    search.delete("service_cancelled");
    const qs = search.toString();
    window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(t);
  }, [notice]);

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

  // Every screen idles back to the attract loop; video gets a long leash.
  useEffect(() => {
    if (screen.kind === "attract") return;
    const timeout = screen.kind === "video" ? VIDEO_IDLE_MS : IDLE_MS;
    const arm = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => setScreen({ kind: "attract" }), timeout);
    };
    arm();
    window.addEventListener("pointerdown", arm, { passive: true });
    window.addEventListener("scroll", arm, { passive: true, capture: true });
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      window.removeEventListener("pointerdown", arm);
      window.removeEventListener("scroll", arm, { capture: true });
    };
  }, [screen.kind]);

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

  const navigate = useCallback((next: KioskScreen) => setScreen(next), []);
  const goHome = useCallback(() => setScreen({ kind: "home" }), []);

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

  const tz = data.property.timezone;

  return (
    // `dark` scopes the theme tokens so embedded shadcn styling + promo
    // accents render their dark variants inside the kiosk canvas.
    <div className="dark fixed inset-0 z-50 select-none overflow-hidden bg-zinc-950 text-zinc-50 font-(family-name:--font-plus-jakarta)">
      {screen.kind === "attract" && (
        <AttractScreen
          data={data}
          onWake={() => setScreen({ kind: "home" })}
          onWeather={() => setScreen({ kind: "weather" })}
        />
      )}
      {screen.kind === "home" && (
        <MainScreen data={data} onHandoff={handoff} onNavigate={navigate} />
      )}
      {screen.kind === "weather" && (
        <WeatherScreen token={token} data={data} onBack={goHome} />
      )}
      {screen.kind === "rules" && <RulesScreen timezone={tz} onBack={goHome} />}
      {screen.kind === "faq" && (
        <FaqScreen faqs={content?.faqs ?? null} failed={contentFailed} timezone={tz} onBack={goHome} />
      )}
      {screen.kind === "videos" && (
        <VideosScreen
          videos={content?.videos ?? null}
          failed={contentFailed}
          timezone={tz}
          onBack={goHome}
          onPlay={(id) => setScreen({ kind: "video", id })}
        />
      )}
      {screen.kind === "video" && (
        <VideoPlayerScreen
          token={token}
          videoId={screen.id}
          timezone={tz}
          onBack={() => setScreen({ kind: "videos" })}
        />
      )}
      {screen.kind === "services" && (
        <ServicesScreen
          token={token}
          services={content?.services ?? null}
          failed={contentFailed}
          booking={data.booking}
          timezone={tz}
          onBack={goHome}
        />
      )}
      {screen.kind === "promos" && (
        <PromosScreen promos={content?.promos ?? null} failed={contentFailed} timezone={tz} onBack={goHome} />
      )}
      {screen.kind === "explore" && <ExploreScreen timezone={tz} onBack={goHome} />}

      {notice && (
        <div className="pointer-events-none absolute inset-x-0 top-6 z-50 flex justify-center px-6">
          <div
            className={`flex items-center gap-3 rounded-2xl px-6 py-4 text-lg font-semibold backdrop-blur-md ${
              notice === "success"
                ? "bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-400/40"
                : "bg-white/10 text-white/90 ring-1 ring-white/20"
            }`}
          >
            {notice === "success" ? (
              <>
                <CheckCircle2 className="h-6 w-6" /> Payment received — you&apos;re all set!
              </>
            ) : (
              <>
                <XCircle className="h-6 w-6" /> Checkout cancelled — no charge was made.
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
