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
      className="fixed inset-0 z-[100] bg-black/95 flex flex-col animate-in fade-in duration-200"
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
      className="fixed inset-0 z-[90] bg-background flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300"
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
                      pos === 0 ? "col-span-2 aspect-[2/1]" : "aspect-[4/3]"
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
              className="relative shrink-0 w-full snap-start aspect-[4/3]"
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
