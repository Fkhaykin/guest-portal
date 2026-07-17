"use client";

import { useSyncExternalStore } from "react";

const KIOSK_RETURN_KEY = "kiosk-return-url";

// Same client-only gating pattern as KioskChromeGate: the flag lives in
// sessionStorage (set by /kiosk/[token] before handing off), so it is scoped
// to the kiosk's own tab and can never mark a normal guest's browser.
const subscribe = () => () => {};
const getSnapshot = () => {
  try {
    return sessionStorage.getItem(KIOSK_RETURN_KEY) !== null;
  } catch {
    return false;
  }
};
const getServerSnapshot = () => false;

/** True when this tab is the in-house kiosk. Lets portal pages render a
 *  kiosk-first layout (full-height boards, no scrolling) in JSX rather than
 *  bending the phone layout with CSS alone. */
export function useIsKiosk(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
