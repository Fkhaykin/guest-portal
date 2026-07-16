"use client";

import { useEffect, useRef } from "react";

// Hidden "escape hatch" for staff: tap the four corners clockwise
// (top-left → top-right → bottom-right → bottom-left) then the center four
// times to fire `onUnlock` — used to jump a locked single-house kiosk back to
// the house selector. Purely observational: it watches pointer-downs at the
// window level (capture phase, never preventing default), so normal button
// taps keep working and the code just registers alongside them.

type Region = "TL" | "TR" | "BR" | "BL" | "C";

const SEQUENCE: Region[] = ["TL", "TR", "BR", "BL", "C", "C", "C", "C"];
// Too long between taps → assume it wasn't the code and start over, so a stray
// corner tap can't leave a half-entered sequence lingering for the next person.
const RESET_MS = 6000;

// Generous zones (outer 30% for corners, central 30% box) so the code is easy
// to hit on a large display; taps in the neutral bands between them are ignored
// (they neither advance nor reset), which keeps the code forgiving to enter.
function regionAt(x: number, y: number, w: number, h: number): Region | null {
  const left = x < w * 0.3;
  const right = x > w * 0.7;
  const top = y < h * 0.3;
  const bottom = y > h * 0.7;
  if (top && left) return "TL";
  if (top && right) return "TR";
  if (bottom && right) return "BR";
  if (bottom && left) return "BL";
  const midX = x > w * 0.35 && x < w * 0.65;
  const midY = y > h * 0.35 && y < h * 0.65;
  if (midX && midY) return "C";
  return null;
}

export function useUnlockGesture(onUnlock: () => void) {
  const progress = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep the latest callback without re-subscribing the listener each render.
  const onUnlockRef = useRef(onUnlock);
  useEffect(() => {
    onUnlockRef.current = onUnlock;
  });

  useEffect(() => {
    const clear = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
    const armReset = () => {
      clear();
      timer.current = setTimeout(() => {
        progress.current = 0;
      }, RESET_MS);
    };

    const onPointerDown = (e: PointerEvent) => {
      const region = regionAt(
        e.clientX,
        e.clientY,
        window.innerWidth,
        window.innerHeight
      );
      if (!region) return; // neutral tap — leave progress untouched

      if (region === SEQUENCE[progress.current]) {
        progress.current += 1;
        if (progress.current === SEQUENCE.length) {
          clear();
          progress.current = 0;
          onUnlockRef.current();
          return;
        }
        armReset();
      } else {
        // Wrong region: restart — but let this tap seed the sequence if it
        // happens to match the first step.
        progress.current = region === SEQUENCE[0] ? 1 : 0;
        if (progress.current) armReset();
        else clear();
      }
    };

    window.addEventListener("pointerdown", onPointerDown, {
      capture: true,
      passive: true,
    });
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, {
        capture: true,
      });
      clear();
    };
  }, []);
}
