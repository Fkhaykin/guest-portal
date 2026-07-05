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
/*  Photo semantics — classify by caption, then allocate by role       */
/* ------------------------------------------------------------------ */

export type PhotoRole =
  | "living"
  | "kitchen"
  | "dining"
  | "bedroom"
  | "bathroom"
  | "amenity"
  | "outdoor"
  | "view"
  | "area"
  | "other";

/** What a photo shows, judged from its room caption. `area` photos are
 *  attractions and community spots — never house imagery. */
export function classifyPhoto(caption?: string): PhotoRole {
  if (!caption) return "other";
  const c = caption.toLowerCase();
  if (/falls|mountain|outlet|stable|downtown|min drive|min walk|community|soccer|court|marina|golf/.test(c))
    return "area";
  if (/view|gazebo|beach|lake across|lakefront|dock|aerial/.test(c)) return "view";
  if (/hot tub|sauna|game|gym|theater|arcade|billiard|ping pong|foosball|projector|screen/.test(c))
    return "amenity";
  if (/living|sunroom|lounge|family room|den/.test(c)) return "living";
  if (/kitchen/.test(c)) return "kitchen";
  if (/dining|breakfast/.test(c)) return "dining";
  if (/bedroom|bunk|loft/.test(c)) return "bedroom";
  if (/bathroom|shower/.test(c)) return "bathroom";
  if (/deck|patio|backyard|yard|exterior|porch|balcon|grill|fire pit|firepit|outside|front/.test(c))
    return "outdoor";
  return "other";
}

export type PhotoPlan = {
  /** Curated hero mosaic — diverse rooms, never area shots */
  mosaic: number[];
  /** Interior trio after the description */
  collageA: number[];
  /** Outdoor/amenity trio after the calendar */
  collageB: number[];
  /** Wide scenic pick for the interlude band (null = hide) */
  scenic: number | null;
  /** Masonry wall picks, interleaved room-by-room */
  wall: number[];
  /** Area/attraction trio for the closing band */
  closing: number[];
};

/** Take up to `count` unused photos from the given role buckets, at most one
 *  per room — and optionally at most one per role, for maximum variety. */
function takeFromRoles(
  buckets: Map<PhotoRole, number[]>,
  images: GalleryImage[],
  roles: PhotoRole[],
  count: number,
  used: Set<number>,
  onePerRole = false
): number[] {
  const picks: number[] = [];
  const seenRooms = new Set<string>();
  for (const role of roles) {
    let tookFromRole = false;
    for (const i of buckets.get(role) ?? []) {
      if (picks.length >= count) return picks;
      if (used.has(i)) continue;
      if (onePerRole && tookFromRole) break;
      const room = images[i].caption ? displayLabel(images[i].caption!) : `#${i}`;
      if (seenRooms.has(room)) continue;
      seenRooms.add(room);
      used.add(i);
      picks.push(i);
      tookFromRole = true;
    }
  }
  return picks;
}

/** Sequential fallback for caption-less sets (skips area photos). */
function takeNext(
  images: GalleryImage[],
  count: number,
  used: Set<number>
): number[] {
  const picks: number[] = [];
  for (let i = 0; i < images.length && picks.length < count; i++) {
    if (used.has(i) || classifyPhoto(images[i].caption) === "area") continue;
    used.add(i);
    picks.push(i);
  }
  return picks;
}

export function planPhotoSections(images: GalleryImage[]): PhotoPlan {
  const used = new Set<number>();
  const buckets = new Map<PhotoRole, number[]>();
  images.forEach((img, i) => {
    const role = classifyPhoto(img.caption);
    if (!buckets.has(role)) buckets.set(role, []);
    buckets.get(role)!.push(i);
  });
  const captioned = images.some((img) => img.caption);

  // --- Hero mosaic: the listing's hero first, then one tile per distinct
  // room role so the top of the page reads as a tour, not five takes of the
  // same sofa — and never an attraction photo.
  const mosaic: number[] = [];
  if (images.length) {
    const heroOk = classifyPhoto(images[0].caption) !== "area";
    const hero = heroOk ? 0 : (takeNext(images, 1, used)[0] ?? 0);
    used.add(hero);
    mosaic.push(hero);
    mosaic.push(
      ...takeFromRoles(
        buckets, images,
        ["view", "outdoor", "kitchen", "bedroom", "amenity", "living", "dining", "bathroom"],
        4, used, true
      )
    );
    if (mosaic.length < 5) mosaic.push(...takeNext(images, 5 - mosaic.length, used));
  }

  // --- Interior collage after the description
  let collageA = takeFromRoles(
    buckets, images, ["living", "kitchen", "dining", "bedroom", "amenity"], 3, used
  );
  if (collageA.length < 3) collageA = [...collageA, ...takeNext(images, 3 - collageA.length, used)];

  // --- Outdoor/amenity collage after the calendar
  let collageB = takeFromRoles(
    buckets, images, ["amenity", "outdoor", "view", "bedroom"], 3, used
  );
  if (!captioned) collageB = [...collageB, ...takeNext(images, 3 - collageB.length, used)];

  // --- Scenic interlude: a wide view shot
  const scenic =
    takeFromRoles(buckets, images, ["view"], 1, used)[0] ??
    takeFromRoles(buckets, images, ["outdoor"], 1, used)[0] ??
    (!captioned ? takeNext(images, 1, used)[0] : undefined) ??
    null;

  // --- Closing band: attractions only
  const closing = takeFromRoles(buckets, images, ["area"], 3, used);

  // --- Gallery wall: interleave the remaining photos round-robin across
  // roles so the masonry flows room-by-room instead of dumping the tail of
  // the tour order.
  const wall: number[] = [];
  const wallRoles: PhotoRole[] = [
    "living", "kitchen", "dining", "bedroom", "amenity", "outdoor", "bathroom", "view", "other",
  ];
  const cursors = new Map<PhotoRole, number>();
  while (wall.length < 14) {
    let advanced = false;
    for (const role of wallRoles) {
      if (wall.length >= 14) break;
      const list = buckets.get(role) ?? [];
      let cur = cursors.get(role) ?? 0;
      while (cur < list.length && used.has(list[cur])) cur++;
      cursors.set(role, cur + 1);
      if (cur < list.length) {
        used.add(list[cur]);
        wall.push(list[cur]);
        advanced = true;
      }
    }
    if (!advanced) break;
  }

  return {
    mosaic: mosaic.length === 5 ? mosaic : [0, 1, 2, 3, 4].filter((i) => i < images.length),
    collageA: collageA.length === 3 ? collageA : [],
    collageB: collageB.length === 3 ? collageB : [],
    scenic,
    wall: wall.length >= 6 ? wall : [],
    closing: closing.length === 3 ? closing : [],
  };
}

/* ------------------------------------------------------------------ */
/*  Parallax image — drifts slower than the scroll inside its frame    */
/* ------------------------------------------------------------------ */

function ParallaxImg({
  src,
  alt,
  strength = 0.1,
  eager = false,
}: {
  src: string;
  alt: string;
  /** Fraction of viewport-offset translated onto the image */
  strength?: number;
  eager?: boolean;
}) {
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = ref.current;
    if (!img) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    const update = () => {
      raf = 0;
      const frame = img.parentElement;
      if (!frame) return;
      const r = frame.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      // -1 … 1 as the frame's center crosses the viewport
      const progress = (r.top + r.height / 2 - window.innerHeight / 2) / window.innerHeight;
      img.style.transform = `translateY(${(-progress * strength * 100).toFixed(2)}px) scale(1.15)`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    // Only listen while the frame is anywhere near the viewport
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          update();
          window.addEventListener("scroll", onScroll, { passive: true });
        } else {
          window.removeEventListener("scroll", onScroll);
        }
      },
      { rootMargin: "20% 0px" }
    );
    io.observe(img.parentElement ?? img);
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [strength]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={src}
      alt={alt}
      className="absolute inset-0 w-full h-full object-cover scale-115 will-change-transform"
      loading={eager ? "eager" : "lazy"}
      draggable={false}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Editorial collage — one tall photo, two stacked beside it          */
/* ------------------------------------------------------------------ */

export function EditorialCollage({
  images,
  picks,
  propertyName,
  flip = false,
}: {
  images: GalleryImage[];
  picks: number[];
  propertyName: string;
  /** Mirror the layout so consecutive collages don't look stamped */
  flip?: boolean;
}) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  if (picks.length !== 3) return null;

  const chip = (idx: number) =>
    images[idx].caption && (
      <span className="absolute bottom-3 left-3 rounded-full bg-black/35 backdrop-blur-sm px-2.5 py-1 text-white/95 text-xs font-medium">
        {displayLabel(images[idx].caption!)}
      </span>
    );

  const tile = (idx: number, className: string, parallax = false) => (
    <button
      key={idx}
      onClick={() => setLightboxIndex(idx)}
      className={`group relative overflow-hidden rounded-2xl focus-visible:ring-2 focus-visible:ring-ring ${className}`}
    >
      {parallax ? (
        <ParallaxImg
          src={images[idx].url}
          alt={images[idx].caption || `${propertyName} photo`}
          strength={0.08}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={images[idx].url}
          alt={images[idx].caption || `${propertyName} photo`}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
          loading="lazy"
        />
      )}
      {chip(idx)}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
    </button>
  );

  return (
    <>
      <div className="grid grid-cols-3 grid-rows-2 gap-2 md:gap-3">
        {tile(picks[0], `row-span-2 ${flip ? "order-last" : ""} col-span-2`, true)}
        {tile(picks[1], "aspect-4/3")}
        {tile(picks[2], "aspect-4/3")}
      </div>
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
/*  Gallery wall — masonry of photos the page hasn't shown yet         */
/* ------------------------------------------------------------------ */

export function GalleryWall({
  images,
  picks,
  propertyName,
}: {
  images: GalleryImage[];
  picks: number[];
  propertyName: string;
}) {
  const [tourOpen, setTourOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const groups = useMemo(() => buildGroups(images), [images]);

  if (picks.length < 6) return null;

  return (
    <section id="gallery" className="scroll-mt-32 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary mb-2">
            Gallery
          </p>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">The full picture</h2>
        </div>
        <button
          onClick={() => setTourOpen(true)}
          className="text-sm font-medium text-primary hover:underline underline-offset-4"
        >
          View all {images.length} photos →
        </button>
      </div>

      <div className="columns-2 md:columns-3 gap-3">
        {picks.map((idx) => (
          <button
            key={idx}
            onClick={() => setLightboxIndex(idx)}
            className="group relative block w-full mb-3 overflow-hidden rounded-xl focus-visible:ring-2 focus-visible:ring-ring break-inside-avoid"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={images[idx].url}
              alt={images[idx].caption || `${propertyName} photo`}
              className="w-full transition-transform duration-700 group-hover:scale-[1.03]"
              loading="lazy"
            />
            {images[idx].caption && (
              <span className="absolute bottom-2 left-2.5 text-white/90 text-xs font-medium drop-shadow opacity-0 group-hover:opacity-100 transition-opacity">
                {displayLabel(images[idx].caption)}
              </span>
            )}
          </button>
        ))}
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
/*  Triptych — three captioned tiles (closing area band)               */
/* ------------------------------------------------------------------ */

export function Triptych({
  images,
  picks,
}: {
  images: GalleryImage[];
  picks: number[];
}) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  if (picks.length !== 3) return null;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {picks.map((idx) => (
          <button
            key={idx}
            onClick={() => setLightboxIndex(idx)}
            className="group relative aspect-4/3 overflow-hidden rounded-2xl focus-visible:ring-2 focus-visible:ring-ring"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={images[idx].url}
              alt={images[idx].caption || "Nearby"}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
              loading="lazy"
            />
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-black/55 to-transparent" />
            {images[idx].caption && (
              <p className="absolute bottom-2.5 left-3 right-3 text-left text-white text-sm font-medium drop-shadow">
                {images[idx].caption}
              </p>
            )}
          </button>
        ))}
      </div>
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

  const shown = cards;

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

export function ScenicBreak({
  images,
  pick,
  propertyName,
}: {
  images: GalleryImage[];
  /** Index chosen by the photo plan; null hides the band */
  pick: number | null;
  propertyName: string;
}) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (pick === null || pick < 0 || pick >= images.length) return null;
  const img = images[pick];

  return (
    <>
      <button
        onClick={() => setLightboxIndex(pick)}
        className="group relative block w-full aspect-16/10 sm:aspect-21/9 rounded-3xl overflow-hidden focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ParallaxImg
          src={img.url}
          alt={img.caption || `${propertyName} surroundings`}
          strength={0.16}
        />
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-black/60 via-black/20 to-transparent" />
        <div className="absolute bottom-4 left-5 sm:bottom-7 sm:left-8 text-left">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70 mb-1">
            The setting
          </p>
          {img.caption && (
            <p className="text-white text-lg sm:text-2xl font-semibold drop-shadow max-w-xl text-balance">
              {img.caption}
            </p>
          )}
        </div>
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
  mosaicPicks,
}: {
  images: GalleryImage[];
  propertyName: string;
  /** Curated tile indices from the photo plan (hero first); defaults to tour order */
  mosaicPicks?: number[];
}) {
  const [tourOpen, setTourOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [mobileIndex, setMobileIndex] = useState(0);
  const mobileRef = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => buildGroups(images), [images]);

  if (images.length === 0) return null;

  const mosaic = (mosaicPicks?.length ? mosaicPicks : [0, 1, 2, 3, 4])
    .filter((i) => i < images.length)
    .map((i) => ({ ...images[i], index: i }));

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
              key={img.index}
              onClick={() => setLightboxIndex(img.index)}
              className={`relative overflow-hidden group focus-visible:ring-2 focus-visible:ring-ring focus-visible:z-10 ${
                i === 0 ? "col-span-2 row-span-2" : ""
              }`}
              aria-label={img.caption || `Photo ${img.index + 1}`}
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
