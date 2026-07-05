"use client";

import { useSyncExternalStore } from "react";
import { LiveChatWidget } from "./live-chat-widget";

// The live-chat widget is guest-facing, but it's mounted in the root layout,
// which also wraps the admin and manager portals — where the host doesn't need
// to message themselves. We can't key off usePathname(): under the subdomain
// rewrite it returns the external path (e.g. "/" on admin.*, not "/admin"), so
// it misses the admin/manager subdomains. Gate on the host instead.
//
// useSyncExternalStore reads the host only on the client: the server snapshot is
// `false` (render nothing), and the client snapshot resolves the real host after
// hydration — no mismatch, and no flash of the launcher on admin/manager.
const subscribe = () => () => {};
const getGuestHostSnapshot = () => {
  if (/^(admin|manager)\./i.test(window.location.host)) return false;
  // In-house kiosks get no chat launcher — a wall tablet can't hold a support
  // conversation, and the bubble floats over every kiosk screen. Two signals:
  // the /kiosk path itself (covers first boot + admin preview, where the
  // localStorage flag isn't set yet), and the same flag IdleReturnGate keys
  // on for portal pages opened from the kiosk.
  if (window.location.pathname.startsWith("/kiosk")) return false;
  try {
    if (localStorage.getItem("kiosk-return-url")) return false;
  } catch {
    // storage unavailable — treat as a normal guest browser
  }
  return true;
};
const getServerSnapshot = () => false;

export function LiveChatGate() {
  const isGuestHost = useSyncExternalStore(subscribe, getGuestHostSnapshot, getServerSnapshot);
  if (!isGuestHost) return null;
  return <LiveChatWidget />;
}
