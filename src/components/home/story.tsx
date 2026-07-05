"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Pause, Play } from "lucide-react";
import Link from "next/link";

/* ------------------------------------------------------------------ */
/*  Scroll-driven storytelling pieces for the home page: parallax      */
/*  bands, an interactive seasons explorer, count-up stats, and a      */
/*  lazy-mounted video interlude. Motion respects reduced-motion.      */
/* ------------------------------------------------------------------ */

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/* ---------------- Parallax primitives ---------------- */

function useParallax(ref: React.RefObject<HTMLElement | null>, strength: number) {
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    let visible = false;

    function update() {
      raf = 0;
      if (!el) return;
      const box = el.parentElement!.getBoundingClientRect();
      const progress =
        (box.top + box.height / 2 - window.innerHeight / 2) /
        (window.innerHeight / 2 + box.height / 2);
      el.style.transform = `translate3d(0, ${(-progress * strength).toFixed(1)}px, 0)`;
    }
    function onScroll() {
      if (visible && !raf) raf = requestAnimationFrame(update);
    }

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) onScroll();
    });
    io.observe(el.parentElement!);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    update();
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ref, strength]);
}

/** Full-bleed image band with parallax and a layered scrim tuned for
 *  bright plates. Content renders over the image. */
export function StoryBand({
  img,
  alt,
  children,
  minHeight = "min-h-[62vh] sm:min-h-[70vh]",
  align = "center",
}: {
  img: string;
  alt: string;
  children: React.ReactNode;
  minHeight?: string;
  align?: "center" | "end";
}) {
  const imgRef = useRef<HTMLDivElement>(null);
  useParallax(imgRef, 70);

  return (
    <section className={`relative ${minHeight} overflow-hidden flex w-full`}>
      <div ref={imgRef} className="absolute -inset-y-20 inset-x-0 will-change-transform">
        <img
          src={img}
          alt={alt}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover saturate-[.92]"
        />
      </div>
      <div className="absolute inset-0 bg-black/25" />
      <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/35 to-black/35" />
      <div className="absolute inset-0 bg-linear-to-r from-black/50 via-black/10 to-transparent" />
      <div
        className={`relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 flex flex-col ${
          align === "center" ? "justify-center" : "justify-end"
        } py-16 sm:py-24`}
      >
        {children}
      </div>
    </section>
  );
}

/* ---------------- Count-up stat ---------------- */

/** Animates from 0 to `value` the first time it scrolls into view. */
export function CountUp({
  value,
  decimals = 0,
  suffix = "",
  duration = 1400,
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(prefersReducedMotion() ? value : 0);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) {
      setDisplay(value);
      return;
    }
    let raf = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - t, 3);
          setDisplay(value * eased);
          if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.6 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [value, duration]);

  return (
    <span ref={ref} className="tabular-nums">
      {display.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}

/* ---------------- Seasons explorer ---------------- */

const BUCKET =
  "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images";

const SEASONS = [
  {
    id: "winter",
    label: "Winter",
    headline: "Ski-lift mornings, sauna nights.",
    copy: "Camelback and Shawnee are minutes away — come home to a steaming hot tub and a stacked fireplace.",
    activities: ["Camelback slopes", "Snow tubing", "Sauna nights", "Fireside game rooms"],
    img: `${BUCKET}/site/home/season-winter.jpg`,
    alt: "Skiers on a snowy Pocono slope",
  },
  {
    id: "spring",
    label: "Spring",
    headline: "The lake wakes up quiet.",
    copy: "First paddles, waterfall hikes at full flow, and weekends before the crowds find their way back.",
    activities: ["Waterfall hikes", "First paddle", "Trout season", "Quiet weekends"],
    img: `${BUCKET}/site/home/season-spring.jpg`,
    alt: "Aerial view of a green Pocono lake in spring",
  },
  {
    id: "summer",
    label: "Summer",
    headline: "Every day ends at the water.",
    copy: "Kayaks off the dock, lake beaches down the road, and long evenings on the grill deck.",
    activities: ["Kayaks & paddle boats", "Lake beaches", "BBQ decks", "Community pools"],
    img: `${BUCKET}/lodgify-368827/airbnb/39-additional-photos-image-7.jpg`,
    alt: "Red picnic tables on a lake beach in summer",
  },
  {
    id: "fall",
    label: "Fall",
    headline: "Foliage down to the waterline.",
    copy: "Hot-tub leaf peeping, fire pits every night, and the best hiking weather of the year.",
    activities: ["Hot-tub leaf peeping", "Fire pits", "Bushkill Falls", "Sweater hikes"],
    img: `${BUCKET}/lodgify-368827/airbnb/22-patio-image-1.jpg`,
    alt: "Steaming hot tub on a deck surrounded by autumn trees",
  },
];

const SEASON_INTERVAL = 6000;

export function SeasonsExplorer() {
  const [index, setIndex] = useState(3); // open on fall — matches the hot-tub money shot
  const [paused, setPaused] = useState(false);
  const [seen, setSeen] = useState<Set<number>>(() => new Set([3]));
  const sectionRef = useRef<HTMLElement>(null);
  const inViewRef = useRef(false);

  function goTo(i: number) {
    const next = (i + SEASONS.length) % SEASONS.length;
    setIndex(next);
    setSeen((s) => (s.has(next) ? s : new Set(s).add(next)));
  }

  // Auto-advance while on screen; pauses on hover/focus and for
  // reduced-motion users.
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      inViewRef.current = entry.isIntersecting;
    });
    io.observe(el);
    const timer = setInterval(() => {
      if (inViewRef.current && !paused) goTo(index + 1);
    }, SEASON_INTERVAL);
    return () => {
      io.disconnect();
      clearInterval(timer);
    };
  }, [index, paused]);

  const season = SEASONS[index];

  return (
    <section
      ref={sectionRef}
      aria-label="Summit Lakeside through the seasons"
      className="relative min-h-[80vh] sm:min-h-svh overflow-hidden flex"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") goTo(index + 1);
        if (e.key === "ArrowLeft") goTo(index - 1);
      }}
    >
      {/* Stacked crossfading backgrounds — an image mounts the first time
          its season is shown and stays for instant revisits */}
      {SEASONS.map((s, i) => (
        <div
          key={s.id}
          className="absolute inset-0 transition-opacity duration-1000 ease-in-out"
          style={{ opacity: i === index ? 1 : 0 }}
          aria-hidden={i !== index}
        >
          {(seen.has(i) || i === index) && (
            <img
              src={s.img}
              alt={i === index ? s.alt : ""}
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover saturate-[.95]"
            />
          )}
        </div>
      ))}
      <div className="absolute inset-0 bg-black/25" />
      <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/30 to-black/40" />
      <div className="absolute inset-0 bg-linear-to-r from-black/55 via-black/15 to-transparent" />

      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 flex flex-col justify-end pb-24 sm:pb-28 pt-32">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.3em] text-white/70">
          <span className="h-1 w-1 rounded-full bg-white/70" />
          One lake, four seasons
        </span>

        {/* Fixed-height stage so tab switches never reflow the page */}
        <div className="mt-4 min-h-64 sm:min-h-72">
          <h2
            key={season.id}
            className="text-5xl sm:text-7xl font-bold tracking-tight text-white leading-[0.95] max-w-3xl text-balance animate-in fade-in slide-in-from-bottom-2 duration-700 [text-shadow:0_1px_24px_rgb(0_0_0/0.45)]"
          >
            {season.headline}
          </h2>
          <p
            key={`${season.id}-copy`}
            className="mt-5 text-lg sm:text-xl text-white/85 max-w-xl leading-relaxed text-pretty animate-in fade-in duration-1000 [text-shadow:0_1px_16px_rgb(0_0_0/0.5)]"
          >
            {season.copy}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {season.activities.map((a) => (
              <span
                key={a}
                className="rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-sm text-white/90 backdrop-blur-sm"
              >
                {a}
              </span>
            ))}
          </div>
          <Link
            href="/search"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-white/90"
          >
            Find {season.label.toLowerCase()} dates
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Season tabs with auto-advance progress */}
        <div
          className="mt-10 grid grid-cols-4 gap-2 sm:gap-3 max-w-xl"
          role="tablist"
          aria-label="Choose a season"
        >
          {SEASONS.map((s, i) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={i === index}
              onClick={() => goTo(i)}
              className={`group text-left pt-3 border-t-2 transition-colors ${
                i === index
                  ? "border-white text-white"
                  : "border-white/30 text-white/60 hover:text-white hover:border-white/60"
              }`}
            >
              <span className="text-sm font-semibold">{s.label}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Evening video interlude ---------------- */

/** Full-bleed looping fire video. The <video> mounts only when the band
 *  approaches the viewport; phones and reduced-motion get the poster. */
export function EveningInterlude() {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [playing, setPlaying] = useState(false);
  useParallax(mediaRef, 60);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    if (
      prefersReducedMotion() ||
      !window.matchMedia("(min-width: 640px)").matches ||
      (navigator as { connection?: { saveData?: boolean } }).connection?.saveData
    )
      return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVideoEnabled(true);
          io.disconnect();
        }
      },
      { rootMargin: "100% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!videoEnabled) return;
    videoRef.current?.play().then(() => setPlaying(true)).catch(() => {});
  }, [videoEnabled]);

  function toggle() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  }

  return (
    <section
      ref={sectionRef}
      className="relative min-h-[62vh] sm:min-h-[72vh] overflow-hidden flex"
    >
      <div ref={mediaRef} className="absolute -inset-y-16 inset-x-0 will-change-transform">
        <img
          src="/videos/fire.jpg"
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        {videoEnabled && (
          <video
            ref={videoRef}
            className="bg-video absolute inset-0 w-full h-full object-cover"
            src="/videos/fire.mp4"
            poster="/videos/fire.jpg"
            muted
            loop
            playsInline
            aria-hidden
          />
        )}
      </div>
      <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/30 to-black/40" />
      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 flex flex-col items-center justify-center text-center py-20">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.3em] text-white/70">
          <span className="h-1 w-1 rounded-full bg-white/70" />
          After dark
        </span>
        <h2 className="mt-4 text-4xl sm:text-6xl font-bold tracking-tight text-white text-balance [text-shadow:0_1px_24px_rgb(0_0_0/0.5)]">
          Evenings are the amenity.
        </h2>
        <p className="mt-5 text-lg sm:text-xl text-white/85 max-w-xl leading-relaxed [text-shadow:0_1px_16px_rgb(0_0_0/0.5)]">
          Fire pits stocked, hot tubs at 102°, and nobody checking the time.
          S&rsquo;mores are non-negotiable.
        </p>
      </div>
      {videoEnabled && (
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pause background video" : "Play background video"}
          className="absolute bottom-5 right-4 sm:right-6 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/60 hover:text-white"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
      )}
    </section>
  );
}
