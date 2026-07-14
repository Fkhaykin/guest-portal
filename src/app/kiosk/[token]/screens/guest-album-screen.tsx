"use client";

import { useCallback, useEffect, useState } from "react";
import { Camera, Check, Clock, Loader2, Trash2, X } from "lucide-react";
import { KioskScreenShell, KioskEmpty, KioskSpinner, glassButton } from "../ui";
import type { KioskBooking, KioskGuestPhoto } from "../types";

// The guest reviews and deletes the photos they took this stay. "Pending"
// photos are awaiting the host's approval for the house album; "published" ones
// are already live.
export function GuestAlbumScreen({
  token,
  booking,
  timezone,
  onBack,
  onTakePhoto,
}: {
  token: string;
  booking: KioskBooking | null;
  timezone: string;
  onBack: () => void;
  onTakePhoto: () => void;
}) {
  const [photos, setPhotos] = useState<KioskGuestPhoto[] | null>(null);
  const [active, setActive] = useState<KioskGuestPhoto | null>(null);
  const [deleting, setDeleting] = useState(false);

  const regId = booking?.reservation.id;
  const guestToken = booking?.guest_token;

  useEffect(() => {
    // No booking → the `!booking` branch renders below; nothing to fetch.
    if (!regId || !guestToken) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(
        `/api/kiosk/${token}/photos?registration_id=${encodeURIComponent(regId)}`,
        { headers: { "x-guest-token": guestToken }, cache: "no-store" }
      );
      const data = await res.json().catch(() => null);
      if (cancelled) return;
      setPhotos(res.ok && Array.isArray(data?.photos) ? data.photos : []);
    })();
    return () => {
      cancelled = true;
    };
  }, [token, regId, guestToken]);

  const remove = useCallback(async () => {
    if (!active || !regId || !guestToken) return;
    setDeleting(true);
    const res = await fetch(`/api/kiosk/${token}/photos`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "x-guest-token": guestToken },
      body: JSON.stringify({ id: active.id, registration_id: regId }),
    });
    setDeleting(false);
    if (res.ok) {
      setPhotos((prev) => (prev ? prev.filter((p) => p.id !== active.id) : prev));
      setActive(null);
    }
  }, [active, regId, guestToken, token]);

  return (
    <KioskScreenShell
      title="My Photos"
      subtitle="Everything you snapped this stay"
      timezone={timezone}
      onBack={onBack}
    >
      {!booking ? (
        <KioskEmpty message="Your photo album opens once a stay is checked in." />
      ) : photos === null ? (
        <KioskSpinner />
      ) : photos.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-6">
          <KioskEmpty message="No photos yet — hop into the photo booth." />
          <button
            type="button"
            onClick={onTakePhoto}
            className="flex min-h-16 items-center gap-3 rounded-3xl bg-fuchsia-500 px-8 text-xl font-extrabold text-white shadow-xl transition-transform active:scale-[0.97]"
          >
            <Camera className="h-6 w-6" /> Open Photo Booth
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setActive(p)}
              className="group relative aspect-square overflow-hidden rounded-2xl bg-(--k-surf-10) ring-1 ring-(--k-surf-15)"
            >
              {p.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.url}
                  alt=""
                  className="h-full w-full object-cover transition-transform group-active:scale-[0.98]"
                />
              )}
              <span
                className={`absolute left-2 top-2 flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold backdrop-blur-md ${
                  p.status === "published"
                    ? "bg-emerald-500/25 text-emerald-100"
                    : "bg-amber-500/25 text-amber-100"
                }`}
              >
                {p.status === "published" ? (
                  <>
                    <Check className="h-3 w-3" /> In house album
                  </>
                ) : (
                  <>
                    <Clock className="h-3 w-3" /> Pending
                  </>
                )}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Enlarged view + delete */}
      {active && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-black/90 p-6"
          onClick={() => setActive(null)}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => setActive(null)}
            className="absolute right-5 top-5 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white"
          >
            <X className="h-6 w-6" />
          </button>
          {active.url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={active.url}
              alt=""
              className="max-h-[70vh] max-w-full rounded-2xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              remove();
            }}
            disabled={deleting}
            className={`flex min-h-16 items-center gap-2 px-8 text-xl font-bold text-white disabled:opacity-50 ${glassButton}`}
          >
            {deleting ? <Loader2 className="h-6 w-6 animate-spin" /> : <Trash2 className="h-6 w-6" />}
            Delete photo
          </button>
        </div>
      )}
    </KioskScreenShell>
  );
}
