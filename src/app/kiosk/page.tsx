"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronRight, Delete, House, LockKeyhole } from "lucide-react";

// House selector for the kiosk subdomain (kiosk.summitlakeside.com). One shared
// admin PIN unlocks the picker on a fresh tablet; picking a house exchanges the
// PIN for that house's device_key (stored under the same localStorage key the
// per-house kiosk client reads), then hands off to /kiosk/[token]. The chosen
// house is remembered so every later boot skips straight into it — add
// ?pick=1 to force the picker back (to re-assign a tablet).

const PIN_LENGTH = 6;
// Must match kiosk-client.tsx's DEVICE_KEY so the house page finds the key.
const DEVICE_KEY = "kiosk-device-key";
const SELECTED_TOKEN = "kiosk-selected-token";

type Kiosk = { token: string; name: string; slug: string | null };

function enterHouse(token: string, deviceKey: string) {
  try {
    localStorage.setItem(DEVICE_KEY, deviceKey);
    localStorage.setItem(SELECTED_TOKEN, token);
  } catch {
    // Storage blocked — the key still rides along for this navigation via the
    // freshly-set value; a wiped-storage tablet just re-picks next boot.
  }
  // Full navigation so the kiosk client mounts fresh and reads the stored key.
  window.location.assign(`/kiosk/${token}`);
}

export default function KioskSelectorPage() {
  // "resolving" until we know whether a house is already remembered.
  const [phase, setPhase] = useState<"resolving" | "pin" | "picking">(
    "resolving",
  );
  const [pin, setPin] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [houses, setHouses] = useState<Kiosk[]>([]);
  const [entering, setEntering] = useState<string | null>(null);

  // Remembered-house redirect (unless ?pick= forces the picker).
  useEffect(() => {
    const forcePick = new URLSearchParams(window.location.search).has("pick");
    let remembered: string | null = null;
    try {
      remembered = localStorage.getItem(SELECTED_TOKEN);
    } catch {
      // ignore
    }
    if (remembered && !forcePick) {
      window.location.replace(`/kiosk/${remembered}`);
      return;
    }
    setPhase("pin");
  }, []);

  const press = useCallback(
    (digit: string) => {
      if (checking) return;
      setError(null);
      setPin((p) => (p.length < PIN_LENGTH ? p + digit : p));
    },
    [checking],
  );

  const backspace = useCallback(() => {
    if (checking) return;
    setError(null);
    setPin((p) => p.slice(0, -1));
  }, [checking]);

  // Auto-submit the admin PIN on the last digit.
  useEffect(() => {
    if (phase !== "pin" || pin.length !== PIN_LENGTH) return;
    let cancelled = false;
    (async () => {
      setChecking(true);
      try {
        const res = await fetch("/api/kiosk/select", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin }),
        });
        if (res.ok) {
          const j = (await res.json()) as { houses: Kiosk[] };
          if (!cancelled) {
            setHouses(j.houses);
            setPhase("picking");
          }
          return;
        }
        if (!cancelled) {
          setError(
            res.status === 401
              ? "Wrong PIN — try again"
              : "Something went wrong — try again",
          );
          setPin("");
        }
      } catch {
        if (!cancelled) {
          setError("No connection — try again");
          setPin("");
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pin, phase]);

  // Physical keyboard (admin previewing on a laptop).
  useEffect(() => {
    if (phase !== "pin") return;
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      if (e.key === "Backspace") backspace();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, press, backspace]);

  const pickHouse = useCallback(
    async (token: string) => {
      if (entering) return;
      setEntering(token);
      setError(null);
      try {
        const res = await fetch("/api/kiosk/select", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin, token }),
        });
        if (res.ok) {
          const j = (await res.json()) as { device_key: string };
          enterHouse(token, j.device_key);
          return; // navigating away
        }
        setError(
          res.status === 401
            ? "Session expired — enter the PIN again"
            : "Couldn't open that house — try again",
        );
        if (res.status === 401) {
          setPhase("pin");
          setPin("");
        }
      } catch {
        setError("No connection — try again");
      } finally {
        setEntering(null);
      }
    },
    [pin, entering],
  );

  if (phase === "resolving") {
    return (
      <div className="fixed inset-0 z-50 bg-zinc-950 font-(family-name:--font-plus-jakarta)" />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 overflow-auto bg-zinc-950 px-6 py-10 text-zinc-100 font-(family-name:--font-plus-jakarta)">
      {phase === "pin" ? (
        <>
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
              <LockKeyhole className="h-7 w-7 text-white/80" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight">Kiosk setup</h1>
            <p className="max-w-xs text-sm text-zinc-400">
              Enter the admin PIN to choose which house this tablet runs.
            </p>
          </div>

          <div className="flex h-6 items-center gap-3" aria-label="PIN entry">
            {Array.from({ length: PIN_LENGTH }, (_, i) => (
              <span
                key={i}
                className={`h-4 w-4 rounded-full transition-colors ${
                  i < pin.length ? "bg-white" : "bg-white/15"
                }`}
              />
            ))}
          </div>

          <p
            className={`h-5 text-sm ${error ? "text-red-400" : "text-transparent"}`}
            role="alert"
          >
            {error ?? "."}
          </p>

          <div
            className={`grid grid-cols-3 gap-4 ${checking ? "pointer-events-none opacity-50" : ""}`}
          >
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <button
                key={d}
                type="button"
                onPointerDown={() => press(d)}
                className="h-20 w-20 rounded-full bg-white/10 text-3xl font-semibold text-white transition-colors active:bg-white/25"
              >
                {d}
              </button>
            ))}
            <span />
            <button
              type="button"
              onPointerDown={() => press("0")}
              className="h-20 w-20 rounded-full bg-white/10 text-3xl font-semibold text-white transition-colors active:bg-white/25"
            >
              0
            </button>
            <button
              type="button"
              onPointerDown={backspace}
              aria-label="Delete last digit"
              className="flex h-20 w-20 items-center justify-center rounded-full text-white/70 transition-colors active:bg-white/10"
            >
              <Delete className="h-8 w-8" />
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
              <House className="h-7 w-7 text-white/80" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight">Choose this house</h1>
            <p className="max-w-xs text-sm text-zinc-400">
              Tap the house this tablet lives in. It&apos;ll remember it and boot
              straight in from now on.
            </p>
          </div>

          <p
            className={`h-5 text-sm ${error ? "text-red-400" : "text-transparent"}`}
            role="alert"
          >
            {error ?? "."}
          </p>

          <div className="grid w-full max-w-md gap-3">
            {houses.map((h) => (
              <button
                key={h.token}
                type="button"
                onClick={() => pickHouse(h.token)}
                disabled={!!entering}
                className={`flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-5 py-5 text-left text-lg font-semibold transition-colors active:bg-white/15 ${
                  entering === h.token ? "opacity-60" : ""
                } ${entering && entering !== h.token ? "pointer-events-none opacity-40" : ""}`}
              >
                <span>{h.name}</span>
                <ChevronRight className="h-5 w-5 text-white/50" />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
