"use client";

import { useEffect, useState } from "react";
import { Camera, ScanLine, Sparkles } from "lucide-react";
import { KioskScreenShell, KioskEmpty, glassPanel } from "../ui";
import type { KioskBooking } from "../types";

// "Continue on your phone" — the kiosk already knows the current guest (its
// property's active reservation, resolved server-side into `booking`), so the
// QR encodes a magic-login URL that seeds that guest's session on their phone.
// Same reg + signed guest token the kiosk's own handoff() uses, dropped into
// /checkin?reg=&token=, which /api/guest/preview verifies before logging in.
// No new endpoint or credential — the token is already in the kiosk payload.

const STEPS: { icon: typeof Camera; text: string }[] = [
  { icon: Camera, text: "Open your phone's camera" },
  { icon: ScanLine, text: "Point it at the code below" },
  { icon: Sparkles, text: "Tap the link — you're signed in" },
];

export function PhoneScreen({
  booking,
  timezone,
  onBack,
}: {
  booking: KioskBooking | null;
  timezone: string;
  onBack: () => void;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrFailed, setQrFailed] = useState(false);

  const regId = booking?.reservation.id;
  const guestToken = booking?.guest_token;

  useEffect(() => {
    if (!regId || !guestToken) return;
    let cancelled = false;
    setQrDataUrl(null);
    setQrFailed(false);

    // Origin (not NEXT_PUBLIC_APP_URL) so the phone lands on the same host the
    // kiosk is served from. Built here — never at module scope — to keep
    // `window` out of any server render.
    const loginUrl = `${window.location.origin}/checkin?reg=${encodeURIComponent(
      regId
    )}&token=${encodeURIComponent(guestToken)}`;

    (async () => {
      try {
        const QRCode = (await import("qrcode")).default;
        const url = await QRCode.toDataURL(loginUrl, {
          width: 640,
          margin: 1,
          errorCorrectionLevel: "M",
          color: { dark: "#0a0a0a", light: "#ffffff" },
        });
        if (!cancelled) setQrDataUrl(url);
      } catch {
        if (!cancelled) setQrFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [regId, guestToken]);

  return (
    <KioskScreenShell
      title="Continue on Your Phone"
      subtitle="Take your stay with you — you'll be signed in automatically"
      timezone={timezone}
      onBack={onBack}
    >
      {!booking ? (
        <KioskEmpty message="This opens once a stay is checked in." />
      ) : (
        <div className="mx-auto flex h-full max-w-5xl flex-col items-center justify-center gap-10 pb-10 lg:flex-row lg:items-center lg:gap-16">
          {/* QR — always dark-on-white so any phone camera reads it, in either theme */}
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-3xl bg-white p-5 shadow-xl ring-1 ring-black/5 lg:p-6">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrDataUrl}
                  alt="Scan to open your guest portal"
                  className="h-64 w-64 lg:h-80 lg:w-80"
                />
              ) : (
                <div className="flex h-64 w-64 items-center justify-center lg:h-80 lg:w-80">
                  {qrFailed ? (
                    <p className="px-6 text-center text-base font-medium text-zinc-500">
                      Couldn&apos;t load the code. Please tap Home and try again.
                    </p>
                  ) : (
                    <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-800" />
                  )}
                </div>
              )}
            </div>
            <p className="text-base font-semibold text-(--k-fg-60)">
              Signed in as {booking.first_name}
            </p>
          </div>

          {/* Steps */}
          <div className="w-full max-w-md space-y-4">
            <p className="text-xl font-medium leading-relaxed text-(--k-fg-75) lg:text-2xl">
              Your registration, add-ons, directions, and everything for your
              stay — right in your pocket.
            </p>
            <div className="space-y-3">
              {STEPS.map((step, i) => (
                <div key={i} className={`flex items-center gap-4 px-5 py-4 ${glassPanel}`}>
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-(--k-surf-10) text-(--k-fg)">
                    <step.icon className="h-6 w-6" />
                  </span>
                  <span className="flex items-center gap-3 text-lg font-semibold text-(--k-fg) lg:text-xl">
                    <span className="text-(--k-fg-50) tabular-nums">{i + 1}.</span>
                    {step.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </KioskScreenShell>
  );
}
