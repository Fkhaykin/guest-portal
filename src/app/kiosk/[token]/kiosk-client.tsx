"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import type { KioskContent, KioskData, KioskScreen } from "./types";
import { KioskThemeContext, useNow, type KioskTheme, type KioskThemeMode } from "./ui";
import { useUnlockGesture } from "./use-unlock-gesture";
import { AttractScreen } from "./attract-screen";
import { PinScreen } from "./pin-screen";
import { MainScreen } from "./main-screen";
import { CleanerScreen } from "./screens/cleaner-screen";
import { WeatherScreen } from "./screens/weather-screen";
import { RulesScreen } from "./screens/rules-screen";
import { FaqScreen } from "./screens/faq-screen";
import { VideosScreen } from "./screens/videos-screen";
import { VideoPlayerScreen } from "./screens/video-player-screen";
import { ServicesScreen } from "./screens/services-screen";
import { PromosScreen } from "./screens/promos-screen";
import { ExploreScreen } from "./screens/explore-screen";
import { TipScreen } from "./screens/tip-screen";
import { PhoneScreen } from "./screens/phone-screen";
import { PhotoboothScreen } from "./screens/photobooth-screen";
import { GuestAlbumScreen } from "./screens/guest-album-screen";
import { HouseAlbumScreen } from "./screens/house-album-screen";
import { HelpOverlay } from "./help-overlay";

const SESSION_KEY = "guest-portal-session";
const TOKEN_KEY = "guest-portal-token";
const KIOSK_RETURN_KEY = "kiosk-return-url";
const DEVICE_KEY = "kiosk-device-key";
// Last reservation the device reset its theme for — lets each new booking start
// on "auto" while a within-booking pin (light/dark) sticks. See below.
const THEME_BOOKING_KEY = "kiosk-theme-booking";

const REFETCH_MS = 15 * 60 * 1000;
const IDLE_MS = 90 * 1000; // any screen → attract after 90s untouched
const VIDEO_IDLE_MS = 30 * 60 * 1000; // don't idle out mid-video
const NOTICE_MS = 12 * 1000;
const RELOAD_HOUR = 4; // nightly self-reload picks up deploys, clears leaks
// After waking from the attract screen, swallow tile taps briefly: a touch's
// trailing click can otherwise land on whatever tile mounts under the finger.
const WAKE_GUARD_MS = 500;

// Kiosk theme mode, persisted per-device. useSyncExternalStore keeps it
// out of an effect (no cascading-render lint) and in sync across the tree.
// "auto" (default) tracks the house's local time of day; "light"/"dark" pin it.
const THEME_KEY = "kiosk-theme";
function readMode(): KioskThemeMode {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : "auto";
  } catch {
    return "auto";
  }
}
function subscribeTheme(cb: () => void) {
  window.addEventListener("kiosk-theme-change", cb);
  return () => window.removeEventListener("kiosk-theme-change", cb);
}

// Daytime (7am–7pm) at the house is light; night is dark. `now` re-evaluates
// on a minute ticker so the kiosk flips at the boundary without a reload.
function resolveAutoTheme(timezone: string | null, now: Date): KioskTheme {
  let hour: number;
  try {
    hour = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: timezone ?? undefined,
        hour: "numeric",
        hourCycle: "h23",
      }).format(now)
    );
  } catch {
    hour = now.getHours(); // invalid tz string — fall back to device local time
  }
  return hour >= 7 && hour < 19 ? "light" : "dark";
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
  const [navigating, setNavigating] = useState(false);
  // undefined = still resolving (checking the URL pin / localStorage),
  // null = this device needs the PIN screen, string = authorized device key.
  const [deviceKey, setDeviceKey] = useState<string | null | undefined>(undefined);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wokeAtRef = useRef(0);

  const mode = useSyncExternalStore(subscribeTheme, readMode, () => "auto" as KioskThemeMode);
  const toggleTheme = useCallback(() => {
    const cur = readMode();
    const next: KioskThemeMode = cur === "auto" ? "light" : cur === "light" ? "dark" : "auto";
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // storage unavailable — theme just won't persist across reloads
    }
    window.dispatchEvent(new Event("kiosk-theme-change"));
  }, []);
  // In auto mode the theme follows the house clock; the minute ticker flips it
  // at 7am/7pm. Pinned light/dark ignore the clock.
  const themeTick = useNow(60 * 1000);
  const theme: KioskTheme =
    mode === "auto" ? resolveAutoTheme(data?.property.timezone ?? null, themeTick) : mode;

  // Each new booking starts on "auto"; a guest's light/dark pin then sticks for
  // the rest of their stay. Reset when the reservation on the device changes.
  const bookingId = data?.booking?.reservation.id ?? null;
  useEffect(() => {
    if (!bookingId) return;
    try {
      if (localStorage.getItem(THEME_BOOKING_KEY) !== bookingId) {
        localStorage.setItem(THEME_BOOKING_KEY, bookingId);
        localStorage.setItem(THEME_KEY, "auto");
        window.dispatchEvent(new Event("kiosk-theme-change"));
      }
    } catch {
      // storage unavailable — no per-booking reset, mode just stays as-is
    }
  }, [bookingId]);

  // Hidden staff gesture — corners clockwise (TL→TR→BR→BL) then center ×4 —
  // escapes this locked single-house display back to the house selector.
  // ?pick=1 bypasses the selector's remembered-house auto-redirect (which would
  // otherwise bounce straight back here); the selector still gates on the PIN.
  useUnlockGesture(
    useCallback(() => {
      window.location.assign("/kiosk?pick=1");
    }, [])
  );

  // Persist + activate an authorized device key (PIN screen or URL pin).
  const authorize = useCallback((key: string) => {
    try {
      localStorage.setItem(DEVICE_KEY, key);
    } catch {
      // Storage unavailable — the key still works for this page's lifetime
    }
    setDeviceKey(key);
  }, []);

  // The kiosk payload is device-gated (see /api/kiosk/[token]/device). The key
  // comes from localStorage or, on browsers that wipe storage between sessions
  // (Edge public-browser kiosk mode), from a ?pin= in the configured start URL.
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(DEVICE_KEY);
    } catch {
      // ignore
    }
    const search = new URLSearchParams(window.location.search);
    const pin = search.get("pin");
    if (!pin) {
      setDeviceKey(stored);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/kiosk/${token}/device`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin }),
        });
        if (res.ok) {
          const j = (await res.json()) as { device_key: string };
          // Scrub the PIN from the address bar so a guest at the screen
          // can't read it. Done only after success — under a StrictMode
          // double-mount both runs need to see the param.
          const qs = new URLSearchParams(window.location.search);
          qs.delete("pin");
          const s = qs.toString();
          window.history.replaceState({}, "", window.location.pathname + (s ? `?${s}` : ""));
          if (!cancelled) authorize(j.device_key);
          return;
        }
      } catch {
        // fall through to whatever the device already had
      }
      if (!cancelled) setDeviceKey(stored);
    })();
    return () => {
      cancelled = true;
    };
  }, [token, authorize]);

  const load = useCallback(async () => {
    if (!deviceKey) return;
    const headers = { "x-kiosk-device": deviceKey };
    try {
      const search = process.env.NODE_ENV === "development" ? window.location.search : "";
      const [mainRes, contentRes] = await Promise.all([
        fetch(`/api/kiosk/${token}${search}`, { cache: "no-store", headers }),
        fetch(`/api/kiosk/${token}/content`, { cache: "no-store", headers }),
      ]);
      if (mainRes.status === 401) {
        // Stale key (or the host reset the house's devices) — back to the PIN.
        try {
          localStorage.removeItem(DEVICE_KEY);
        } catch {
          // ignore
        }
        setDeviceKey(null);
        return;
      }
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
  }, [token, deviceKey]);

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

  // Returning from a handoff page via "Kiosk Home" carries ?home=1 — open on
  // the home grid instead of the default screensaver. Scrub it afterward.
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    if (search.get("home") !== "1") return;
    setScreen({ kind: "home" });
    search.delete("home");
    const qs = search.toString();
    window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
  }, []);

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

  // Refetch right when the screen should flip — the payload says how long
  // until the next checkout/check-in/midnight boundary. The 20s pad lands
  // safely on the far side of the minute-resolution boundary.
  useEffect(() => {
    const secs = data?.refresh_in_seconds;
    if (!secs || exited) return;
    const t = setTimeout(load, Math.max(30, secs) * 1000 + 20 * 1000);
    return () => clearTimeout(t);
  }, [data, exited, load]);

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
      // Ignore the trailing click of the wake tap (see WAKE_GUARD_MS).
      if (Date.now() - wokeAtRef.current < WAKE_GUARD_MS) return;
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
      // Show a matching loading cover FIRST so the old screen doesn't linger
      // during the full-page navigation; wait two frames so it actually paints.
      setNavigating(true);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => window.location.assign(href))
      );
    },
    [data]
  );

  const navigate = useCallback((next: KioskScreen) => {
    // Same wake-tap guard as handoff, so a ghost click can't open a sub-screen.
    if (Date.now() - wokeAtRef.current < WAKE_GUARD_MS) return;
    setScreen(next);
  }, []);
  const goHome = useCallback(() => setScreen({ kind: "home" }), []);
  // Waking stamps the guard clock; the screen swap itself bypasses the guard.
  const wakeToHome = useCallback(() => {
    wokeAtRef.current = Date.now();
    setScreen({ kind: "home" });
  }, []);
  const wakeToWeather = useCallback(() => {
    wokeAtRef.current = Date.now();
    setScreen({ kind: "weather" });
  }, []);

  if (exited) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950 text-zinc-100 font-(family-name:--font-plus-jakarta)">
        <p className="max-w-sm text-center text-lg text-zinc-400">
          Kiosk mode is off for this device. You can close this tab.
        </p>
      </div>
    );
  }

  if (deviceKey === null) {
    return <PinScreen token={token} onAuthorized={authorize} />;
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
    <KioskThemeContext.Provider value={{ theme, mode, toggle: toggleTheme }}>
    <div
      className={`kiosk-canvas ${theme === "dark" ? "dark" : "kiosk-light"} fixed inset-0 z-50 select-none overflow-hidden bg-(--k-bg) text-(--k-fg) font-(family-name:--font-plus-jakarta)`}
    >
      {/* Vacant house: the idle screen greets the turnover crew and never
          wakes into the guest app — only the weather is reachable. */}
      {screen.kind === "attract" &&
        (data.state === "none" ? (
          <CleanerScreen data={data} />
        ) : (
          <AttractScreen
            token={token}
            data={data}
            onWake={wakeToHome}
            onWeather={wakeToWeather}
          />
        ))}
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
        <WeatherScreen
          token={token}
          data={data}
          onBack={data.state === "none" ? () => setScreen({ kind: "attract" }) : goHome}
        />
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
      {screen.kind === "phone" && (
        <PhoneScreen booking={data.booking} timezone={tz} onBack={goHome} />
      )}
      {screen.kind === "photobooth" && (
        <PhotoboothScreen
          token={token}
          booking={data.booking}
          timezone={tz}
          onBack={goHome}
          onViewAlbum={() => setScreen({ kind: "guest-album" })}
          onViewHouseAlbum={() => setScreen({ kind: "house-album", from: "photobooth" })}
        />
      )}
      {screen.kind === "guest-album" && (
        <GuestAlbumScreen
          token={token}
          booking={data.booking}
          timezone={tz}
          onBack={goHome}
          onTakePhoto={() => setScreen({ kind: "photobooth" })}
        />
      )}
      {screen.kind === "house-album" && (
        <HouseAlbumScreen
          token={token}
          timezone={tz}
          onBack={screen.from === "photobooth" ? () => setScreen({ kind: "photobooth" }) : goHome}
        />
      )}

      {helpOpen && (
        <HelpOverlay data={data} onClose={() => setHelpOpen(false)} onNavigate={navigate} />
      )}

      {navigating && (
        <div className="absolute inset-0 z-70 flex items-center justify-center bg-(--k-bg)">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-(--k-surf-20) border-t-(--k-fg)" />
        </div>
      )}

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
