"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import type { KioskContent, KioskData, KioskScreen } from "./types";
import { KioskThemeContext, type KioskTheme } from "./ui";
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
import { TipScreen } from "./screens/tip-screen";
import { HelpOverlay } from "./help-overlay";

const SESSION_KEY = "guest-portal-session";
const TOKEN_KEY = "guest-portal-token";
const KIOSK_RETURN_KEY = "kiosk-return-url";

const REFETCH_MS = 15 * 60 * 1000;
const IDLE_MS = 90 * 1000; // any screen → attract after 90s untouched
const VIDEO_IDLE_MS = 30 * 60 * 1000; // don't idle out mid-video
const NOTICE_MS = 12 * 1000;
const RELOAD_HOUR = 4; // nightly self-reload picks up deploys, clears leaks

// Kiosk light/dark theme, persisted per-device. useSyncExternalStore keeps it
// out of an effect (no cascading-render lint) and in sync across the tree.
const THEME_KEY = "kiosk-theme";
function readTheme(): KioskTheme {
  try {
    return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}
function subscribeTheme(cb: () => void) {
  window.addEventListener("kiosk-theme-change", cb);
  return () => window.removeEventListener("kiosk-theme-change", cb);
}

export function KioskClient({ token }: { token: string }) {
  const [data, setData] = useState<KioskData | null>(null);
  const [content, setContent] = useState<KioskContent | null>(null);
  const [contentFailed, setContentFailed] = useState(false);
  const [failed, setFailed] = useState(false);
  const [screen, setScreen] = useState<KioskScreen>({ kind: "attract" });
  const [exited, setExited] = useState(false);
  const [notice, setNotice] = useState<"success" | "cancelled" | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "dark" as KioskTheme);
  const toggleTheme = useCallback(() => {
    const next: KioskTheme = readTheme() === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // storage unavailable — theme just won't persist across reloads
    }
    window.dispatchEvent(new Event("kiosk-theme-change"));
  }, []);

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

  // Kiosk-mode flag lives in sessionStorage so it is scoped to THIS tab and
  // cleared when it closes — it can never leak kiosk chrome to a normal guest's
  // browsing (localStorage stuck to any browser that once opened the kiosk URL).
  // The handoff is a same-tab navigation, so the flag survives to /p/[slug]/*,
  // which keeps the kiosk chrome (and hides the website header/logo whose links
  // point back at the marketing site). Admin preview sets it too so the full
  // experience previews accurately — it's tab-scoped, so no stickiness. ?exit=1
  // is the escape hatch.
  useEffect(() => {
    try {
      // Purge the legacy localStorage flag so previously-stuck browsers recover.
      localStorage.removeItem(KIOSK_RETURN_KEY);
    } catch {
      // ignore
    }
    const search = new URLSearchParams(window.location.search);
    if (search.get("exit") === "1") {
      try {
        sessionStorage.removeItem(KIOSK_RETURN_KEY);
      } catch {
        // ignore
      }
      setExited(true);
      return;
    }
    try {
      sessionStorage.setItem(KIOSK_RETURN_KEY, `/kiosk/${token}`);
    } catch {
      // ignore
    }
  }, [token]);

  // A tip's Stripe session still needs finalizing (mark paid + notify host)
  // via the guest upsells confirm route; captured here, run once data loads.
  const [pendingTipSession, setPendingTipSession] = useState<string | null>(null);

  // Stripe return from a kiosk service purchase or tip. The URL cleanup makes
  // this non-idempotent, so the dismiss timer lives in its own effect below —
  // under a double mount (StrictMode) the re-run early-returns and a timer
  // armed here would have been cleared, leaving the banner stuck.
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const success = search.get("service_success") === "1" || search.get("tip_success") === "1";
    const cancelled = search.get("service_cancelled") === "1" || search.get("tip_cancelled") === "1";
    if (!success && !cancelled) return;
    if (search.get("tip_success") === "1") setPendingTipSession(search.get("session_id"));
    setNotice(success ? "success" : "cancelled");
    setScreen({ kind: "home" });
    for (const k of ["service_success", "service_cancelled", "tip_success", "tip_cancelled", "session_id"]) {
      search.delete(k);
    }
    const qs = search.toString();
    window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
  }, []);

  // Finalize a returned tip once the booking (and its guest token) is loaded.
  useEffect(() => {
    if (!pendingTipSession || !data?.booking) return;
    const sessionId = pendingTipSession;
    setPendingTipSession(null);
    fetch(`/api/guest/upsells/confirm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-guest-token": data.booking.guest_token,
      },
      body: JSON.stringify({ session_id: sessionId, registration_id: data.booking.reservation.id }),
    }).catch(() => {
      // Best-effort; the Stripe webhook is the durable fallback.
    });
  }, [pendingTipSession, data]);

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
    // `dark` (dark mode only) scopes shadcn/promo-accent dark: variants; the
    // .kiosk-canvas/.kiosk-light classes drive the --k-* neutral palette.
    <KioskThemeContext.Provider value={{ theme, toggle: toggleTheme }}>
    <div
      className={`kiosk-canvas ${theme === "dark" ? "dark" : "kiosk-light"} fixed inset-0 z-50 select-none overflow-hidden bg-(--k-bg) text-(--k-fg) font-(family-name:--font-plus-jakarta)`}
    >
      {screen.kind === "attract" && (
        <AttractScreen
          token={token}
          data={data}
          onWake={() => setScreen({ kind: "home" })}
          onWeather={() => setScreen({ kind: "weather" })}
        />
      )}
      {screen.kind === "home" && (
        <MainScreen
          data={data}
          content={content}
          onHandoff={handoff}
          onNavigate={navigate}
          onHelp={() => setHelpOpen(true)}
        />
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
      {screen.kind === "explore" && (
        <ExploreScreen community={data.property.community} timezone={tz} onBack={goHome} />
      )}
      {screen.kind === "tip" && (
        <TipScreen token={token} booking={data.booking} timezone={tz} onBack={goHome} />
      )}

      {helpOpen && <HelpOverlay data={data} onClose={() => setHelpOpen(false)} />}

      {notice && (
        <div className="pointer-events-none absolute inset-x-0 top-6 z-50 flex justify-center px-6">
          <div
            className={`flex items-center gap-3 rounded-2xl px-6 py-4 text-lg font-semibold backdrop-blur-md ${
              notice === "success"
                ? "bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-400/40"
                : "bg-(--k-surf-10) text-(--k-fg-90) ring-1 ring-(--k-surf-20)"
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
    </KioskThemeContext.Provider>
  );
}
