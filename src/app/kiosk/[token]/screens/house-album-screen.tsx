"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { KioskScreenShell, KioskEmpty, KioskSpinner } from "../ui";
import type { KioskHousePhoto } from "../types";

// The published house album — guest photos the host approved for display.
// Shown on the kiosk and mirrored on the website property pages.
export function HouseAlbumScreen({
  token,
  timezone,
  onBack,
}: {
  token: string;
  timezone: string;
  onBack: () => void;
}) {
  const [photos, setPhotos] = useState<KioskHousePhoto[] | null>(null);
  const [active, setActive] = useState<KioskHousePhoto | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/kiosk/${token}/house-photos`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!cancelled) setPhotos(res.ok && Array.isArray(data?.photos) ? data.photos : []);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <KioskScreenShell
      title="House Album"
      subtitle="Moments from guests who stayed here"
      timezone={timezone}
      onBack={onBack}
    >
      {photos === null ? (
        <KioskSpinner />
      ) : photos.length === 0 ? (
        <KioskEmpty message="No photos in the house album yet — be the first to add one from the photo booth." />
      ) : (
        <div className="columns-2 gap-3 sm:columns-3 lg:columns-4 [&>*]:mb-3">
          {photos.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setActive(p)}
              className="block w-full overflow-hidden rounded-2xl bg-(--k-surf-10) ring-1 ring-(--k-surf-15)"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt={p.taken_by_name ? `Photo by ${p.taken_by_name}` : ""}
                className="w-full object-cover transition-transform active:scale-[0.98]"
              />
            </button>
          ))}
        </div>
      )}

      {active && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/90 p-6"
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={active.url}
            alt=""
            className="max-h-[78vh] max-w-full rounded-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          {active.taken_by_name && (
            <p className="text-lg font-medium text-white/70">Snapped by {active.taken_by_name}</p>
          )}
        </div>
      )}
    </KioskScreenShell>
  );
}
