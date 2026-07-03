"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Scroll-driven visuals for the rental-policies page: reading         */
/*  progress, a video hero, parallax chapter breakers, and a scrollspy */
/*  chapter bar. All motion respects prefers-reduced-motion, and every */
/*  decorative layer is stripped from print.                           */
/* ------------------------------------------------------------------ */

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/* ---------------- Reading progress ---------------- */

export function ReadingProgress() {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    function update() {
      raf = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const pct = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      if (barRef.current) barRef.current.style.transform = `scaleX(${pct})`;
    }
    function onScroll() {
      if (!raf) raf = requestAnimationFrame(update);
    }
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="fixed top-0 inset-x-0 z-60 h-1 pointer-events-none print:hidden">
      <div
        ref={barRef}
        className="h-full w-full origin-left bg-primary transition-none"
        style={{ transform: "scaleX(0)" }}
      />
    </div>
  );
}

/* ---------------- Shared parallax hook ---------------- */

/** Translates `ref` vertically as it moves through the viewport.
 *  `strength` is the max offset in px; the element should be oversized
 *  (inset by -strength) so edges never show. */
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
      // -1 (below viewport) … 0 (centered) … 1 (above viewport)
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

/* ---------------- Video hero ---------------- */

export function HeroMedia({
  video,
  poster,
  children,
}: {
  video: string;
  poster: string;
  children: React.ReactNode;
}) {
  const mediaRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(false);
  useParallax(mediaRef, 60);

  // Only start the video for users who haven't asked for reduced motion and
  // aren't on a small screen — phones get the still poster (the 16:9 aerial
  // is illegible at 9:16 anyway, and the file is ~1.4 MB of cellular data).
  useEffect(() => {
    const wantsVideo =
      !prefersReducedMotion() &&
      window.matchMedia("(min-width: 640px)").matches &&
      !(navigator as { connection?: { saveData?: boolean } }).connection?.saveData;
    if (wantsVideo) setVideoEnabled(true);
  }, []);

  useEffect(() => {
    if (!videoEnabled) return;
    videoRef.current?.play().then(() => setPlaying(true)).catch(() => {});
  }, [videoEnabled]);

  function togglePlayback() {
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
    <section className="relative h-svh min-h-140 overflow-hidden">
      <div ref={mediaRef} className="absolute -inset-y-16 inset-x-0 will-change-transform print:hidden">
        {/* Poster always renders underneath so there is never a motion flash */}
        <img
          src={poster}
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-[30%_center]"
        />
        {videoEnabled && (
          <video
            ref={videoRef}
            className="bg-video absolute inset-0 w-full h-full object-cover object-[30%_center]"
            src={video}
            poster={poster}
            muted
            loop
            playsInline
            aria-hidden
          />
        )}
      </div>
      <div className="absolute inset-0 bg-linear-to-b from-black/55 via-black/35 to-black/80 print:hidden" />
      {children}
      {videoEnabled && (
        <button
          type="button"
          onClick={togglePlayback}
          aria-label={playing ? "Pause background video" : "Play background video"}
          className="absolute bottom-6 right-4 sm:right-6 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/60 hover:text-white print:hidden"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
      )}
      {/* Scroll cue — a real link to the summary, not decoration */}
      <a
        href="#short-version"
        aria-label="Skip to the short version"
        className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/70 hover:text-white transition-colors animate-bounce motion-reduce:animate-none print:hidden"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </a>
    </section>
  );
}

/* ---------------- Parallax chapter breaker ---------------- */

export function ParallaxBand({
  img,
  alt,
  children,
  align = "end",
}: {
  img: string;
  alt: string;
  children: React.ReactNode;
  align?: "end" | "center";
}) {
  const imgRef = useRef<HTMLDivElement>(null);
  useParallax(imgRef, 70);

  return (
    <div className="relative min-h-[58vh] sm:min-h-[66vh] overflow-hidden flex print:hidden">
      <div ref={imgRef} className="absolute -inset-y-20 inset-x-0 will-change-transform">
        <img
          src={img}
          alt={alt}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover saturate-[.9]"
        />
      </div>
      {/* Scrim stack: base dim + vertical gradient + left text-protection
          wash + a cool multiply grade so seven different shoots read as one
          palette. Tuned for the brightest plate, not the darkest. */}
      <div className="absolute inset-0 bg-black/25" />
      <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/45 to-black/40" />
      <div className="absolute inset-0 bg-linear-to-r from-black/55 via-black/15 to-transparent" />
      <div className="absolute inset-0 bg-[#0f1b24]/20 mix-blend-multiply" />
      <div
        className={`relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 flex flex-col ${
          align === "center" ? "justify-center" : "justify-end"
        } pb-12 sm:pb-16 pt-40`}
      >
        {children}
      </div>
    </div>
  );
}

/* ---------------- Scrollspy chapter bar ---------------- */

export function ChapterNav({
  chapters,
}: {
  chapters: { id: string; index: string; title: string }[];
}) {
  // null until the reader actually reaches a chapter — the bar shouldn't
  // claim a location while they're still in the hero/summary.
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );
    for (const c of chapters) {
      const el = document.getElementById(c.id);
      if (el) io.observe(el);
    }
    function onScroll() {
      const first = document.getElementById(chapters[0]?.id);
      if (first && window.scrollY + window.innerHeight * 0.3 < first.offsetTop) {
        setActive(null);
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [chapters]);

  // Keep the active chip scrolled into view on mobile
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!active) return;
    const el = navRef.current?.querySelector<HTMLElement>(`[data-chapter="${active}"]`);
    el?.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [active]);

  function jump(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
    });
    history.pushState(null, "", `#${id}`);
  }

  return (
    <div className="sticky top-16 z-30 bg-[#101820]/90 backdrop-blur-xl border-b border-white/10 print:hidden">
      <nav
        ref={navRef}
        className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1 overflow-x-auto pr-10 mask-[linear-gradient(to_right,black_calc(100%-2.5rem),transparent)]"
        style={{ scrollbarWidth: "none" }}
        aria-label="Policy chapters"
      >
        <a
          href="#short-version"
          onClick={(e) => jump(e, "short-version")}
          className="shrink-0 flex items-center px-3 py-3 text-sm font-medium border-b-2 -mb-px border-transparent text-white/55 hover:text-white transition-colors"
          aria-label="Back to the short version"
        >
          ↑ Top
        </a>
        {chapters.map((c) => (
          <a
            key={c.id}
            href={`#${c.id}`}
            data-chapter={c.id}
            aria-current={active === c.id ? "true" : undefined}
            onClick={(e) => jump(e, c.id)}
            className={`shrink-0 flex items-baseline gap-1.5 px-3 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              active === c.id
                ? "border-primary text-white"
                : "border-transparent text-white/55 hover:text-white"
            }`}
          >
            <span className="text-[10px] tabular-nums opacity-60">{c.index}</span>
            {c.title}
          </a>
        ))}
      </nav>
    </div>
  );
}
