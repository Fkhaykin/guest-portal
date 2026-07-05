"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Grip, X } from "lucide-react";

export type GalleryImage = { url: string; caption?: string };

/* ------------------------------------------------------------------ */
/*  Grouping — photos with room captions get a category tour           */
/* ------------------------------------------------------------------ */

type PhotoGroup = { label: string; indexes: number[] };

function buildGroups(images: GalleryImage[]): PhotoGroup[] {
  const groups: PhotoGroup[] = [];
  const byLabel = new Map<string, PhotoGroup>();
  const uncaptioned: number[] = [];

  images.forEach((img, i) => {
    const label = img.caption?.trim();
    if (!label) {
      uncaptioned.push(i);
      return;
    }
    let group = byLabel.get(label);
    if (!group) {
      group = { label, indexes: [] };
      byLabel.set(label, group);
      groups.push(group);
    }
    group.indexes.push(i);
  });

  if (uncaptioned.length) {
    groups.push({
      label: groups.length ? "More photos" : "All photos",
      indexes: uncaptioned,
    });
  }
  return groups;
}

function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [locked]);
}

/* ------------------------------------------------------------------ */
/*  Lightbox — fullscreen viewer with keyboard, swipe & filmstrip      */
/* ------------------------------------------------------------------ */

function Lightbox({
  images,
  index,
  onNavigate,
  onClose,
}: {
  images: GalleryImage[];
  index: number;
  onNavigate: (i: number) => void;
  onClose: () => void;
}) {
  const stripRef = useRef<HTMLDivElement>(null);
  const touchX = useRef<number | null>(null);
  const img = images[index];

  const prev = useCallback(
    () => onNavigate((index - 1 + images.length) % images.length),
    [index, images.length, onNavigate]
  );
  const next = useCallback(
    () => onNavigate((index + 1) % images.length),
    [index, images.length, onNavigate]
  );

  useBodyScrollLock(true);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next, onClose]);

  // Keep the active filmstrip thumb centered
  useEffect(() => {
    const btn = stripRef.current?.children[index] as HTMLElement | undefined;
    btn?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [index]);

  return (
    <div
      className="fixed inset-0 z-100 bg-black/95 flex flex-col animate-in fade-in duration-200"
      role="dialog"
      aria-label="Photo viewer"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 h-14 shrink-0 text-white">
        <p className="text-sm font-medium tabular-nums">
          {index + 1} / {images.length}
          {img.caption && (
            <span className="text-white/60 font-normal"> · {img.caption}</span>
          )}
        </p>
        <button
          onClick={onClose}
          className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
          aria-label="Close photo viewer"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Main image */}
      <div
        className="relative flex-1 min-h-0 flex items-center justify-center px-2 sm:px-16 select-none"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (dx > 50) prev();
          else if (dx < -50) next();
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={img.url}
          src={img.url}
          alt={img.caption || `Photo ${index + 1}`}
          className="max-h-full max-w-full object-contain animate-in fade-in duration-300"
          draggable={false}
        />
        {/* Preload neighbors so arrows feel instant */}
        <div className="hidden" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[(index + 1) % images.length].url} alt="" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[(index - 1 + images.length) % images.length].url} alt="" />
        </div>

        {images.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/10 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/20 transition-colors"
              aria-label="Previous photo"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={next}
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/10 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/20 transition-colors"
              aria-label="Next photo"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}
      </div>

      {/* Filmstrip */}
      <div className="shrink-0 px-4 pb-4 pt-2">
        <div
          ref={stripRef}
          className="flex gap-2 overflow-x-auto max-w-4xl mx-auto"
          style={{ scrollbarWidth: "none" }}
        >
          {images.map((im, i) => (
            <button
              key={i}
              onClick={() => onNavigate(i)}
              className={`shrink-0 w-16 h-11 rounded-md overflow-hidden ring-2 transition-all ${
                i === index
                  ? "ring-white opacity-100"
                  : "ring-transparent opacity-45 hover:opacity-80"
              }`}
              aria-label={im.caption ? `View ${im.caption}` : `View photo ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={im.url} alt="" className="w-full h-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Photo tour — full-screen grid grouped by room, with jump chips     */
/* ------------------------------------------------------------------ */

function PhotoTour({
  images,
  groups,
  onOpenPhoto,
  onClose,
}: {
  images: GalleryImage[];
  groups: PhotoGroup[];
  onOpenPhoto: (i: number) => void;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  useBodyScrollLock(true);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function jumpTo(label: string) {
    const el = containerRef.current?.querySelector(
      `[data-tour-group="${CSS.escape(label)}"]`
    );
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const showChips = groups.length > 1;

  return (
    <div
      className="fixed inset-0 z-90 bg-background flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300"
      role="dialog"
      aria-label="All photos"
    >
      {/* Header */}
      <div className="shrink-0 border-b bg-background/95 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <h2 className="font-semibold">Photo tour ({images.length})</h2>
          <button
            onClick={onClose}
            className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-accent transition-colors"
            aria-label="Close photo tour"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {showChips && (
          <div
            className="max-w-5xl mx-auto px-4 sm:px-6 pb-3 flex gap-2 overflow-x-auto"
            style={{ scrollbarWidth: "none" }}
          >
            {groups.map((g) => (
              <button
                key={g.label}
                onClick={() => jumpTo(g.label)}
                className="shrink-0 px-3 py-1.5 rounded-full border text-xs font-medium hover:bg-accent transition-colors whitespace-nowrap"
              >
                {g.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Groups */}
      <div ref={containerRef} className="flex-1 overflow-y-auto overscroll-contain">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-10">
          {groups.map((g) => (
            <section key={g.label} data-tour-group={g.label} className="scroll-mt-4">
              {showChips && (
                <h3 className="text-lg font-semibold mb-3">{g.label}</h3>
              )}
              <div className="grid grid-cols-2 gap-2">
                {g.indexes.map((idx, pos) => (
                  <button
                    key={idx}
                    onClick={() => onOpenPhoto(idx)}
                    className={`relative overflow-hidden rounded-lg group focus-visible:ring-2 focus-visible:ring-ring ${
                      pos === 0 ? "col-span-2 aspect-2/1" : "aspect-4/3"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={images[idx].url}
                      alt={images[idx].caption || `Photo ${idx + 1}`}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Room showcase — editorial strip of one card per room               */
/* ------------------------------------------------------------------ */

/** "Living room 3" → "Living room"; "Gazebo and Lake Beach (10 min…)" → "Gazebo and Lake Beach" */
function displayLabel(label: string) {
  return label.replace(/\s+\d+$/, "").replace(/\s*\(.*\)\s*$/, "");
}

export function RoomShowcase({
  images,
  propertyName,
}: {
  images: GalleryImage[];
  propertyName: string;
}) {
  const [tourOpen, setTourOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const groups = useMemo(() => buildGroups(images), [images]);

  // One card per room: merge caption groups that share a base label
  // ("Living room 1/2/3" → Living room). Caption-less sets fall back to the
  // photos the mosaic didn't show, unlabeled.
  const cards = useMemo(() => {
    const captioned = groups.filter((g) => g.label !== "More photos" && g.label !== "All photos");
    if (captioned.length >= 4) {
      const byBase = new Map<string, { label: string; index: number; count: number }>();
      for (const g of captioned) {
        const base = displayLabel(g.label);
        const existing = byBase.get(base);
        if (existing) existing.count += g.indexes.length;
        else byBase.set(base, { label: base, index: g.indexes[0], count: g.indexes.length });
      }
      return [...byBase.values()];
    }
    return images.slice(5, 15).map((_, i) => ({ label: "", index: i + 5, count: 1 }));
  }, [groups, images]);

  if (images.length < 8 || cards.length < 4) return null;

  const shown = cards.slice(0, 10);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary mb-2">
            The space
          </p>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Wander the house</h2>
        </div>
        <button
          onClick={() => setTourOpen(true)}
          className="text-sm font-medium text-primary hover:underline underline-offset-4"
        >
          View all {images.length} photos →
        </button>
      </div>

      <div
        className="flex gap-4 overflow-x-auto snap-x pb-2 -mx-4 px-4 sm:mx-0 sm:px-0"
        style={{ scrollbarWidth: "none" }}
      >
        {shown.map((card) => (
          <button
            key={card.index}
            onClick={() => setLightboxIndex(card.index)}
            className="group relative shrink-0 snap-start w-52 sm:w-60 aspect-3/4 rounded-2xl overflow-hidden focus-visible:ring-2 focus-visible:ring-ring"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={images[card.index].url}
              alt={card.label || `${propertyName} photo`}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.05]"
              loading="lazy"
            />
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-black/60 via-black/20 to-transparent" />
            {card.label && (
              <div className="absolute bottom-3 left-3 right-3 text-left">
                <p className="text-white text-sm font-semibold leading-tight">{card.label}</p>
                {card.count > 1 && (
                  <p className="text-white/70 text-xs">{card.count} photos</p>
                )}
              </div>
            )}
          </button>
        ))}
        {/* Trailing card → the full tour */}
        <button
          onClick={() => setTourOpen(true)}
          className="shrink-0 snap-start w-52 sm:w-60 aspect-3/4 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground hover:border-solid transition-colors"
        >
          <Grip className="h-5 w-5" />
          <span className="text-sm font-medium">All {images.length} photos</span>
        </button>
      </div>

      {tourOpen && (
        <PhotoTour
          images={images}
          groups={groups}
          onOpenPhoto={(i) => setLightboxIndex(i)}
          onClose={() => setTourOpen(false)}
        />
      )}
      {lightboxIndex !== null && (
        <Lightbox
          images={images}
          index={lightboxIndex}
          onNavigate={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Scenic break — full-width editorial image band                     */
/* ------------------------------------------------------------------ */

// "View …" shots first — the room showcase usually already features the
// gazebo/backyard cards, so the interlude should add a fresh perspective.
const SCENIC_PRIORITY = [/view/i, /lake/i, /gazebo|beach/i, /exterior/i, /backyard/i, /deck|patio/i];

export function ScenicBreak({
  images,
  propertyName,
}: {
  images: GalleryImage[];
  propertyName: string;
}) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const pick = useMemo(() => {
    for (const re of SCENIC_PRIORITY) {
      const i = images.findIndex((img) => img.caption && re.test(img.caption));
      if (i >= 0) return i;
    }
    return images.length > 6 ? 5 : -1;
  }, [images]);

  if (pick < 0) return null;
  const img = images[pick];

  return (
    <>
      <button
        onClick={() => setLightboxIndex(pick)}
        className="group relative block w-full aspect-16/10 sm:aspect-21/9 rounded-3xl overflow-hidden focus-visible:ring-2 focus-visible:ring-ring"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img.url}
          alt={img.caption || `${propertyName} surroundings`}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1.2s] group-hover:scale-[1.03]"
          loading="lazy"
        />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-black/55 to-transparent" />
        {img.caption && (
          <p className="absolute bottom-4 left-5 sm:bottom-6 sm:left-7 text-white text-base sm:text-lg font-semibold text-left drop-shadow">
            {img.caption}
          </p>
        )}
      </button>
      {lightboxIndex !== null && (
        <Lightbox
          images={images}
          index={lightboxIndex}
          onNavigate={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Gallery — desktop mosaic + mobile swipe carousel                   */
/* ------------------------------------------------------------------ */

export function PropertyGallery({
  images,
  propertyName,
}: {
  images: GalleryImage[];
  propertyName: string;
}) {
  const [tourOpen, setTourOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [mobileIndex, setMobileIndex] = useState(0);
  const mobileRef = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => buildGroups(images), [images]);

  if (images.length === 0) return null;

  const mosaic = images.slice(0, 5);

  function onMobileScroll() {
    const el = mobileRef.current;
    if (!el) return;
    setMobileIndex(Math.round(el.scrollLeft / el.clientWidth));
  }

  return (
    <>
      {/* Mobile — swipeable snap carousel */}
      <div className="relative md:hidden">
        <div
          ref={mobileRef}
          onScroll={onMobileScroll}
          className="flex overflow-x-auto snap-x snap-mandatory"
          style={{ scrollbarWidth: "none" }}
        >
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setLightboxIndex(i)}
              className="relative shrink-0 w-full snap-start aspect-4/3"
              aria-label={img.caption || `Photo ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.caption || `${propertyName} photo ${i + 1}`}
                className="absolute inset-0 w-full h-full object-cover"
                loading={i < 2 ? "eager" : "lazy"}
              />
            </button>
          ))}
        </div>
        <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-sm text-white text-xs font-medium tabular-nums">
          {mobileIndex + 1} / {images.length}
        </div>
        <button
          onClick={() => setTourOpen(true)}
          className="absolute bottom-3 left-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm text-white text-xs font-medium"
        >
          <Grip className="h-3.5 w-3.5" /> All photos
        </button>
      </div>

      {/* Desktop — Airbnb-style mosaic */}
      <div className="hidden md:block max-w-7xl mx-auto px-6 pt-6">
        <div className="relative grid grid-cols-4 grid-rows-2 gap-2 rounded-3xl overflow-hidden aspect-[2/0.95] lg:aspect-[2/0.82]">
          {mosaic.map((img, i) => (
            <button
              key={i}
              onClick={() => setLightboxIndex(i)}
              className={`relative overflow-hidden group focus-visible:ring-2 focus-visible:ring-ring focus-visible:z-10 ${
                i === 0 ? "col-span-2 row-span-2" : ""
              }`}
              aria-label={img.caption || `Photo ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.caption || `${propertyName} photo ${i + 1}`}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                loading={i === 0 ? "eager" : "lazy"}
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
            </button>
          ))}
          {images.length > 5 && (
            <button
              onClick={() => setTourOpen(true)}
              className="absolute bottom-4 right-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-white/90 backdrop-blur text-sm font-semibold text-gray-900 shadow-lg hover:bg-white transition-colors"
            >
              <Grip className="h-4 w-4" />
              Show all {images.length} photos
            </button>
          )}
        </div>
      </div>

      {tourOpen && (
        <PhotoTour
          images={images}
          groups={groups}
          onOpenPhoto={(i) => setLightboxIndex(i)}
          onClose={() => setTourOpen(false)}
        />
      )}

      {lightboxIndex !== null && (
        <Lightbox
          images={images}
          index={lightboxIndex}
          onNavigate={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
}
