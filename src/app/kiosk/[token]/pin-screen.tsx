"use client";

import { useCallback, useEffect, useState } from "react";
import { Delete, LockKeyhole } from "lucide-react";

const PIN_LENGTH = 6;

// One-time device activation. The kiosk payload is PIN-gated so a guest who
// reads the URL off the wall device can't open it at home and see whoever is
// currently checked in. A correct PIN comes back as the house's device key,
// which the client persists — this screen should appear once per device.
export function PinScreen({
  token,
  onAuthorized,
}: {
  token: string;
  onAuthorized: (deviceKey: string) => void;
}) {
  const [pin, setPin] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const press = useCallback(
    (digit: string) => {
      if (checking) return;
      setError(null);
      setPin((p) => (p.length < PIN_LENGTH ? p + digit : p));
    },
    [checking]
  );

  const backspace = useCallback(() => {
    if (checking) return;
    setError(null);
    setPin((p) => p.slice(0, -1));
  }, [checking]);

  // Auto-submit on the last digit — no OK button to explain.
  useEffect(() => {
    if (pin.length !== PIN_LENGTH) return;
    let cancelled = false;
    (async () => {
      setChecking(true);
      try {
        const res = await fetch(`/api/kiosk/${token}/device`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin }),
        });
        if (res.ok) {
          const j = (await res.json()) as { device_key: string };
          if (!cancelled) onAuthorized(j.device_key);
          return;
        }
        if (!cancelled) {
          setError(res.status === 401 ? "Wrong PIN — try again" : "Something went wrong — try again");
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
  }, [pin, token, onAuthorized]);

  // Physical keyboards work too (admin previewing on a laptop).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      if (e.key === "Backspace") backspace();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press, backspace]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-zinc-950 px-6 text-zinc-100 font-(family-name:--font-plus-jakarta)">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
          <LockKeyhole className="h-7 w-7 text-white/80" />
        </span>
        <h1 className="text-2xl font-bold tracking-tight">Kiosk setup</h1>
        <p className="max-w-xs text-sm text-zinc-400">
          This display is for guests inside the house. Enter the setup PIN to
          activate it on this device.
        </p>
      </div>

      {/* PIN dots */}
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

      <p className={`h-5 text-sm ${error ? "text-red-400" : "text-transparent"}`} role="alert">
        {error ?? "."}
      </p>

      <div className={`grid grid-cols-3 gap-4 ${checking ? "pointer-events-none opacity-50" : ""}`}>
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

      <p className="max-w-xs text-center text-xs text-zinc-500">
        Hosts: the PIN is on the property&apos;s Kiosk page in the admin panel.
      </p>
    </div>
  );
}
