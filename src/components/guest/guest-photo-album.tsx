"use client";

import { useCallback, useEffect, useState } from "react";
import { Camera, ChevronLeft, ChevronRight, X } from "lucide-react";

export type AlbumPhoto = { id: string; url: string; taken_by_name?: string | null };

// Published guest photos, shown on the property pages. Masonry wall + a
// full-screen lightbox with keyboard/swipe navigation. Self-contained so it can
// drop into both the guest portal home and the public booking page.
export function GuestPhotoAlbum({
  photos,
  title = "Guest Photo Album",
  subtitle = "Real moments from guests who stayed here",
}: {
  photos: AlbumPhoto[];
  title?: string;
  subtitle?: string;
}) {
  const [openAt, setOpenAt] = useState<number | null>(null);

  const close = useCallback(() => setOpenAt(null), []);
  const step = useCallback(
    (dir: number) => {
      setOpenAt((i) => (i === null ? i : (i + dir + photos.length) % photos.length));
    },
    [photos.length]
  );

  useEffect(() => {
    if (openAt === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [openAt, close, step]);

  if (!photos.length) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Camera className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      <div className="columns-2 gap-3 sm:columns-3 lg:columns-4 [&>*]:mb-3">
        {photos.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setOpenAt(i)}
            className="group block w-full overflow-hidden rounded-2xl ring-1 ring-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.url}
              alt={p.taken_by_name ? `Photo by ${p.taken_by_name}` : "Guest photo"}
              loading="lazy"
              className="w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none"
            />
          </button>
        ))}
      </div>

      {openAt !== null && (
        <div
          className="fixed inset-0 z-100 flex flex-col items-center justify-center bg-black/95 p-4"
          onClick={close}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={close}
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <X className="h-6 w-6" />
          </button>

          {photos.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous"
                onClick={(e) => {
                  e.stopPropagation();
                  step(-1);
                }}
                className="absolute left-3 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 md:left-6"
              >
                <ChevronLeft className="h-7 w-7" />
              </button>
              <button
                type="button"
                aria-label="Next"
                onClick={(e) => {
                  e.stopPropagation();
                  step(1);
                }}
                className="absolute right-3 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 md:right-6"
              >
                <ChevronRight className="h-7 w-7" />
              </button>
            </>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photos[openAt].url}
            alt=""
            className="max-h-[82vh] max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="mt-3 flex items-center gap-3 text-sm text-white/70">
            {photos[openAt].taken_by_name && <span>Snapped by {photos[openAt].taken_by_name}</span>}
            <span className="tabular-nums">
              {openAt + 1} / {photos.length}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
