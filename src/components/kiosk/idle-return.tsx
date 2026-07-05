"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const KIOSK_RETURN_KEY = "kiosk-return-url";
const IDLE_MS = 120 * 1000;

/** Globally mounted, self-gating (same pattern as LiveChatGate): a no-op
 *  unless this browser is a kiosk (flag set by /kiosk/[token]). On kiosk
 *  devices, any portal page left untouched returns to the kiosk home so the
 *  next guest never finds someone else's session on screen. */
export function IdleReturnGate() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname.startsWith("/kiosk/")) return;

    let returnUrl: string | null = null;
    try {
      returnUrl = localStorage.getItem(KIOSK_RETURN_KEY);
    } catch {
      return;
    }
    if (!returnUrl) return;
    const target = returnUrl;

    let timer: ReturnType<typeof setTimeout>;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => window.location.assign(target), IDLE_MS);
    };
    arm();

    const events = ["pointerdown", "touchstart", "keydown", "scroll"] as const;
    for (const e of events) window.addEventListener(e, arm, { passive: true });
    return () => {
      clearTimeout(timer);
      for (const e of events) window.removeEventListener(e, arm);
    };
  }, [pathname]);

  return null;
}
