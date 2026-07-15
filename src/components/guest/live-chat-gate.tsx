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
// The kiosk (/kiosk/* is never subdomain-rewritten, so pathname is reliable
// there) has its own full-screen UI and Help overlay — the launcher would
// float over it.
const subscribe = () => () => {};
const getGuestHostSnapshot = () =>
  !/^(admin|manager)\./i.test(window.location.host) &&
  !window.location.pathname.startsWith("/kiosk");
const getServerSnapshot = () => false;

export function LiveChatGate() {
  const isGuestHost = useSyncExternalStore(subscribe, getGuestHostSnapshot, getServerSnapshot);
  if (!isGuestHost) return null;
  return <LiveChatWidget />;
}
