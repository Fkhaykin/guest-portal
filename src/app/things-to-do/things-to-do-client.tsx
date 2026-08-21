"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { PhotoCredits } from "@/components/marketing/content-blocks";
import {
  MapPin,
  ArrowUpRight,
  Compass,
  ArrowLeft,
  ArrowRight,
  Fish,
} from "lucide-react";
import {
  img,
  guideImg,
  CATEGORIES,
  COMMUNITIES,
  DIVIDERS,
  IMAGE_CREDITS,
  type Activity,
  type Category,
  type Community,
  type CommunityAmenity,
  type CommunityGroup,
  type Divider,
} from "@/lib/things-to-do-content";

/* ------------------------------------------------------------------ */
/*  Smart Image — gracefully falls back to a gradient if loading fails */
/* ------------------------------------------------------------------ */

function SmartImage({
  src,
  alt,
  className,
  fallback,
  style,
  priority = false,
}: {
  src: string;
  alt: string;
  className?: string;
  fallback: string;
  style?: React.CSSProperties;
  priority?: boolean;
}) {
  const [errored, setErrored] = useState(false);

  if (errored) {
    return (
      <div
        className={`${className ?? ""} bg-linear-to-br ${fallback}`}
        style={style}
        aria-label={alt}
        role="img"
      />
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      onError={() => setErrored(true)}
      className={className}
      style={style}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Hooks                                                              */
/* ------------------------------------------------------------------ */

function useScrollY() {
  const [y, setY] = useState(0);
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setY(window.scrollY));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);
  return y;
}

function useScrollProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    let raf = 0;
    const handler = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = document.documentElement;
        const max = el.scrollHeight - el.clientHeight;
        setP(max > 0 ? (el.scrollTop / max) * 100 : 0);
      });
    };
    window.addEventListener("scroll", handler, { passive: true });
    handler();
    return () => {
      window.removeEventListener("scroll", handler);
      cancelAnimationFrame(raf);
    };
  }, []);
  return p;
}

function useInView<T extends HTMLElement>(rootMargin = "0px 0px -80px 0px") {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.unobserve(el);
        }
      },
      { rootMargin, threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);
  return { ref, inView };
}

/* ------------------------------------------------------------------ */
/*  Reveal wrapper                                                     */
/* ------------------------------------------------------------------ */

function Reveal({
  children,
  delay = 0,
  y = 24,
  as: Tag = "div",
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  as?: React.ElementType;
  className?: string;
}) {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <Tag
      ref={ref}
      className={className}
      style={{
        transform: inView ? "translateY(0)" : `translateY(${y}px)`,
        opacity: inView ? 1 : 0,
        transition: `transform 700ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms, opacity 700ms ease ${delay}ms`,
        willChange: "transform, opacity",
      }}
    >
      {children}
    </Tag>
  );
}

/* ------------------------------------------------------------------ */
/*  Parallax divider (full bleed)                                      */
/* ------------------------------------------------------------------ */

function ParallaxDivider({ divider }: { divider: Divider }) {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const [offset, setOffset] = useState(0);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!sectionRef.current) return;
    const el = sectionRef.current;

    let raf = 0;
    const handler = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const vh = window.innerHeight;
        // -1 at top of viewport, 0 at middle, 1 at bottom
        const center = (rect.top + rect.height / 2) / vh - 0.5;
        setOffset(center * 120);
      });
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
        if (entry.isIntersecting) handler();
      },
      { threshold: 0 },
    );
    io.observe(el);

    window.addEventListener("scroll", handler, { passive: true });
    handler();
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", handler);
      cancelAnimationFrame(raf);
    };
  }, []);

  const alignClasses =
    divider.align === "left"
      ? "items-start text-left"
      : divider.align === "right"
        ? "items-end text-right"
        : "items-center text-center";

  return (
    <section
      ref={sectionRef}
      className="relative w-full h-[55vh] min-h-90 max-h-140 overflow-hidden rounded-lg my-16 sm:my-24"
    >
      <div
        className="absolute inset-0 scale-125 will-change-transform"
        style={{
          transform: `translate3d(0, ${offset}px, 0) scale(1.25)`,
          transition: "transform 60ms linear",
        }}
      >
        <SmartImage
          src={divider.image}
          alt={divider.heading}
          className="absolute inset-0 w-full h-full object-cover"
          fallback="from-slate-900 to-slate-700"
        />
      </div>

      <div className="absolute inset-0 bg-linear-to-b from-black/50 via-black/30 to-black/70" />

      <div className="relative h-full max-w-6xl mx-auto px-6 sm:px-10 flex items-center">
        <div
          className={`flex flex-col gap-4 max-w-2xl w-full ${alignClasses}`}
          style={{
            transform: inView ? "translateY(0)" : "translateY(32px)",
            opacity: inView ? 1 : 0,
            transition: "all 900ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <span className="text-xs sm:text-sm uppercase tracking-[0.25em] text-white/70 font-medium">
            {divider.eyebrow}
          </span>
          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-bold text-white leading-[1.05] tracking-tight drop-shadow-lg">
            {divider.heading}
          </h2>
          <p className="text-base sm:text-lg text-white/85 leading-relaxed max-w-xl">
            {divider.sub}
          </p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Activity card                                                      */
/* ------------------------------------------------------------------ */

/** Small-caps dot-separated meta line — replaces pill tags. */
function MetaLine({ parts }: { parts: (string | undefined | null)[] }) {
  const clean = parts.filter(Boolean) as string[];
  if (!clean.length) return null;
  return (
    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground/90 leading-relaxed">
      {clean.join("  ·  ")}
    </p>
  );
}

/** Understated text link with an external arrow — replaces buttons. */
function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-sm font-semibold text-foreground underline decoration-foreground/25 decoration-1 underline-offset-4 hover:decoration-foreground transition-colors"
    >
      {children}
      <ArrowUpRight className="h-3.5 w-3.5" />
    </a>
  );
}

function ActivityCard({
  activity,
  fallback,
  index,
}: {
  activity: Activity;
  fallback: string;
  index: number;
}) {
  return (
    <article className="group">
      <div className="relative aspect-4/3 w-full overflow-hidden rounded-lg bg-muted">
        <SmartImage
          src={activity.image}
          alt={activity.name}
          fallback={fallback}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
        />
      </div>

      <div className="mt-4 border-t border-foreground/15 pt-4">
        <div className="flex items-baseline gap-3">
          <span className="text-xs tabular-nums font-medium text-muted-foreground/60">
            {String(index + 1).padStart(2, "0")}
          </span>
          <h3 className="font-bold text-lg tracking-tight leading-snug">
            {activity.name}
          </h3>
        </div>
        <div className="mt-1.5 pl-7">
          <MetaLine parts={[activity.distance, ...(activity.tags ?? [])]} />
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            {activity.description}
          </p>
          <div className="mt-4 flex items-center gap-6">
            {activity.mapQuery && (
              <TextLink
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activity.mapQuery)}`}
              >
                Directions
              </TextLink>
            )}
            {activity.website && (
              <TextLink href={activity.website}>Website</TextLink>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/*  Community amenity card                                             */
/* ------------------------------------------------------------------ */

function AmenityCard({
  amenity,
  fallback,
  large = false,
}: {
  amenity: CommunityAmenity;
  fallback: string;
  large?: boolean;
}) {
  return (
    <article className={`group ${large ? "sm:col-span-2" : ""}`}>
      <div
        className={`relative w-full overflow-hidden rounded-lg bg-muted ${
          large ? "aspect-video" : "aspect-4/3"
        }`}
      >
        <SmartImage
          src={amenity.image}
          alt={amenity.name}
          fallback={fallback}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
        />
      </div>

      <div className="mt-4 border-t border-foreground/15 pt-4">
        <h4
          className={`font-bold tracking-tight leading-snug ${
            large ? "text-xl" : "text-lg"
          }`}
        >
          {amenity.name}
        </h4>
        <div className="mt-1.5">
          <MetaLine
            parts={[amenity.featured ? "Highlight" : null, ...(amenity.tags ?? [])]}
          />
          {amenity.description && (
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              {amenity.description}
            </p>
          )}
          {amenity.mapQuery && (
            <div className="mt-4">
              <TextLink
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(amenity.mapQuery)}`}
              >
                Open in Maps
              </TextLink>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/*  Community group (sub-section within a community tab)               */
/* ------------------------------------------------------------------ */

function CommunityGroupSection({
  group,
  fallback,
}: {
  group: CommunityGroup;
  fallback: string;
}) {
  const Icon = group.icon;
  return (
    <div className="space-y-5">
      <div className="pt-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className="h-4 w-4" />
          <span className="text-[11px] uppercase tracking-[0.25em] font-semibold">
            {group.subtitle ?? group.title}
          </span>
        </div>
        <h3 className="mt-1.5 text-xl sm:text-2xl font-bold tracking-tight">
          {group.title}
        </h3>
      </div>

      {group.note && (
        <div className="flex gap-2.5 items-start border-l-2 border-foreground/25 pl-4 py-0.5">
          <Fish className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground leading-relaxed">
            {group.note}
          </p>
        </div>
      )}

      <div
        className={
          group.fullWidth
            ? "grid grid-cols-1 gap-5"
            : "grid grid-cols-1 sm:grid-cols-2 gap-5"
        }
      >
        {group.items.map((item, i) => (
          <Reveal key={item.name} delay={i * 50} y={24}>
            <AmenityCard
              amenity={item}
              fallback={fallback}
              large={
                group.fullWidth ||
                (item.featured && group.items.length > 1)
              }
            />
          </Reveal>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Community tab panel — hero banner + groups + map                   */
/* ------------------------------------------------------------------ */

function CommunityPanel({ community }: { community: Community }) {
  const mapEmbed = `https://www.google.com/maps?q=${encodeURIComponent(
    community.mapQuery,
  )}&output=embed`;

  return (
    <div className="space-y-10 pt-6">
      {/* Hero banner */}
      <div className="relative w-full h-64 sm:h-80 rounded-3xl overflow-hidden shadow-xl">
        <SmartImage
          src={community.hero}
          alt={community.name}
          className="absolute inset-0 w-full h-full object-cover"
          fallback={community.gradient}
          priority
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/30 to-black/40" />
        <div
          className={`absolute inset-0 bg-linear-to-br ${community.gradient} mix-blend-multiply opacity-30`}
        />

        <div className="relative h-full flex flex-col justify-end p-6 sm:p-10">
          <span className="mb-3 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.25em] font-semibold text-white/85">
            <MapPin className="h-3 w-3" />
            {community.tagline}
          </span>
          <h3 className="text-3xl sm:text-5xl font-bold text-white tracking-tight drop-shadow-lg">
            {community.name}
          </h3>
          <p className="text-sm sm:text-base text-white/85 mt-3 max-w-2xl leading-relaxed">
            {community.description}
          </p>

          <div className="mt-5 flex flex-wrap gap-5">
            {community.stats.map((s) => (
              <div key={s.label} className="flex flex-col">
                <span className="text-xl sm:text-2xl font-bold text-white">
                  {s.num}
                </span>
                <span className="text-[10px] uppercase tracking-widest text-white/70">
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Amenity groups */}
      <div className="space-y-12">
        {community.groups.map((group) => (
          <CommunityGroupSection
            key={group.key}
            group={group}
            fallback={community.gradient}
          />
        ))}
      </div>

      {/* Embedded map */}
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span className="text-[11px] uppercase tracking-[0.25em] font-semibold">
              {community.name}, East Stroudsburg, PA
            </span>
          </div>
          <h3 className="mt-1.5 text-xl sm:text-2xl font-bold tracking-tight">
            Find it on the map
          </h3>
        </div>
        <div className="relative w-full h-72 sm:h-96 rounded-lg overflow-hidden border bg-muted">
          <iframe
            src={mapEmbed}
            className="absolute inset-0 w-full h-full"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title={`Map of ${community.name}`}
          />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Community section — tabs + panels                                  */
/* ------------------------------------------------------------------ */

function CommunitySection({ communities }: { communities: Community[] }) {
  return (
    <section className="space-y-8">
      <Reveal>
        <div className="border-b border-foreground/60 pb-5">
          <span className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground font-semibold tabular-nums">
            01 — On the Property
          </span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight">
            In the Community
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base mt-1">
            Amenities right here on the property — before you even pick up the keys.
          </p>
        </div>
      </Reveal>

      <Reveal delay={60}>
        <Tabs defaultValue={communities[0]?.id} className="gap-4">
          <TabsList className="w-full justify-start gap-7 h-auto p-0 bg-transparent rounded-none border-b">
            {communities.map((c) => (
              <TabsTrigger
                key={c.id}
                value={c.id}
                className="flex-none px-0 pb-3 pt-0 text-[12px] uppercase tracking-[0.15em] font-semibold rounded-none border-0 border-b-2 border-transparent bg-transparent shadow-none data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none text-muted-foreground data-[state=active]:text-foreground"
              >
                {c.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {communities.map((c) => (
            <TabsContent key={c.id} value={c.id}>
              <CommunityPanel community={c} />
            </TabsContent>
          ))}
        </Tabs>
      </Reveal>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Category section                                                   */
/* ------------------------------------------------------------------ */

function CategorySection({
  category,
  num,
}: {
  category: Category;
  num: number;
}) {
  return (
    <section className="space-y-10">
      <Reveal>
        <div className="border-b border-foreground/60 pb-5">
          <span className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground font-semibold tabular-nums">
            {String(num).padStart(2, "0")} — {category.subtitle}
          </span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight">
            {category.title}
          </h2>
        </div>
      </Reveal>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-12">
        {category.activities.map((activity, i) => (
          <Reveal key={activity.name} delay={i * 60} y={32}>
            <ActivityCard
              activity={activity}
              fallback={category.gradient}
              index={i}
            />
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Nav item list (community + categories)                             */
/* ------------------------------------------------------------------ */

type NavItem = {
  key: string;
  title: string;
};

const NAV_ITEMS: NavItem[] = [
  { key: "community", title: "In the Community" },
  ...CATEGORIES.map((c) => ({ key: c.key, title: c.title })),
];

/* ------------------------------------------------------------------ */
/*  Section nav — vertical rail on desktop, slim underline bar mobile  */
/* ------------------------------------------------------------------ */

function SideNav({
  active,
  onSelect,
}: {
  active: string | null;
  onSelect: (key: string) => void;
}) {
  return (
    <nav className="sticky top-28 border-l border-border">
      <p className="pl-5 mb-4 text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-semibold">
        The Guide
      </p>
      <ul>
        {NAV_ITEMS.map((item, i) => {
          const isActive = active === item.key;
          return (
            <li key={item.key} className="relative">
              {isActive && (
                <span className="absolute -left-px top-1.5 bottom-1.5 w-0.5 bg-foreground" />
              )}
              <button
                onClick={() => onSelect(item.key)}
                className={`flex w-full items-baseline gap-3 pl-5 pr-2 py-2 text-left transition-colors duration-200 ${
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="text-[10px] tabular-nums font-medium opacity-50">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className={`text-sm tracking-tight ${isActive ? "font-semibold" : "font-medium"}`}
                >
                  {item.title}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function MobileNav({
  active,
  onSelect,
}: {
  active: string | null;
  onSelect: (key: string) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // Keep the active item centered in the horizontal scroller.
  // Use direct scrollLeft instead of scrollIntoView — the latter reaches up
  // to the document scroller and jerks the whole page inside a sticky nav.
  useEffect(() => {
    if (!active || !scrollerRef.current) return;
    const scroller = scrollerRef.current;
    const btn = scroller.querySelector<HTMLButtonElement>(
      `button[data-key="${active}"]`,
    );
    if (!btn) return;
    const target =
      btn.offsetLeft - scroller.clientWidth / 2 + btn.offsetWidth / 2;
    scroller.scrollTo({ left: target, behavior: "smooth" });
  }, [active]);

  return (
    <div className="lg:hidden sticky top-(--site-nav-offset) z-40 -mx-4 sm:-mx-6 px-4 sm:px-6 bg-background/85 backdrop-blur-xl border-b transition-[top] duration-300 ease-in-out motion-reduce:transition-none">
      <div
        ref={scrollerRef}
        className="flex gap-6 overflow-x-auto pt-3"
        style={{ scrollbarWidth: "none" }}
      >
        {NAV_ITEMS.map((item) => {
          const isActive = active === item.key;
          return (
            <button
              key={item.key}
              data-key={item.key}
              onClick={() => onSelect(item.key)}
              className={`whitespace-nowrap pb-3 text-[11px] uppercase tracking-[0.15em] font-semibold border-b-2 transition-colors duration-200 ${
                isActive
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground"
              }`}
            >
              {item.title}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function ThingsToDoPage() {
  const [activeSection, setActiveSection] = useState<string | null>(
    NAV_ITEMS[0]?.key ?? null,
  );
  const scrollY = useScrollY();
  const progress = useScrollProgress();

  // Auto-highlight active section based on what's in the middle of the viewport.
  useEffect(() => {
    const ids = NAV_ITEMS.map((c) => c.key);
    const nodes = ids
      .map((k) => document.getElementById(`section-${k}`))
      .filter((n): n is HTMLElement => !!n);
    if (!nodes.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const key = entry.target.id.replace("section-", "");
            setActiveSection(key);
          }
        });
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );

    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);

  function scrollToSection(key: string) {
    setActiveSection(key);
    const el = document.getElementById(`section-${key}`);
    if (el) {
      const offset = 130;
      const top = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }

  // Interleave categories with parallax dividers.
  const interleaved = useMemo(() => {
    const out: ({ type: "category"; cat: Category } | { type: "divider"; div: Divider })[] = [];
    CATEGORIES.forEach((cat) => {
      out.push({ type: "category", cat });
      const div = DIVIDERS.find((d) => d.afterKey === cat.key);
      if (div) out.push({ type: "divider", div });
    });
    return out;
  }, []);

  return (
    <div className="min-h-screen flex flex-col font-(family-name:--font-plus-jakarta)">
      {/* Scroll progress bar */}
      <div
        className="fixed top-0 left-0 right-0 h-0.5 z-60 bg-white origin-left"
        style={{
          transform: `scaleX(${progress / 100})`,
          transition: "transform 100ms linear",
          willChange: "transform",
        }}
      />

      <SiteNav variant="transparent" />

      {/* Hero with parallax + ken-burns */}
      <div className="relative h-[92vh] min-h-140 overflow-hidden">
        <div
          className="absolute inset-0 will-change-transform"
          style={{
            transform: `translate3d(0, ${scrollY * 0.4}px, 0) scale(${1 + Math.min(scrollY, 600) / 6000})`,
          }}
        >
          <SmartImage
            src={guideImg("tammany-hero")}
            alt="The Delaware River winding through the Water Gap, seen from Mt. Tammany"
            className="absolute inset-0 w-full h-full object-cover"
            fallback="from-emerald-900 via-emerald-600 to-sky-400"
            priority
          />
        </div>

        {/* Multi-layer gradient overlays */}
        <div className="absolute inset-0 bg-linear-to-b from-black/55 via-black/10 to-black/80" />
        <div className="absolute inset-0 bg-linear-to-r from-black/40 via-transparent to-transparent" />

        {/* Hero content */}
        <div
          className="absolute inset-0 flex items-end"
          style={{
            transform: `translate3d(0, ${scrollY * 0.15}px, 0)`,
            opacity: Math.max(0, 1 - scrollY / 600),
          }}
        >
          <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 pb-16 sm:pb-24">
            <span className="mb-5 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.25em] font-semibold text-white/85">
              <MapPin className="h-3 w-3" />
              Pocono Mountains, Pennsylvania
            </span>
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-[1.02] max-w-4xl drop-shadow-2xl">
              Your guide to{" "}
              <span className="italic font-serif bg-linear-to-r from-emerald-200 via-white to-sky-200 bg-clip-text text-transparent">
                the Poconos
              </span>
            </h1>
            <p className="text-base sm:text-lg text-white/85 mt-5 max-w-xl leading-relaxed">
              Curated by your hosts at Summit Lakeside — the trails we hike,
              the tables we book, and the hidden waterfalls we only tell our
              favorite guests about.
            </p>

            <div className="mt-8 flex flex-wrap gap-6 text-white/80">
              {[
                { num: "7+", label: "Categories" },
                { num: "30+", label: "Handpicked spots" },
                { num: "15 min", label: "Closest is" },
              ].map((s) => (
                <div key={s.label} className="flex flex-col">
                  <span className="text-2xl sm:text-3xl font-bold text-white">
                    {s.num}
                  </span>
                  <span className="text-xs uppercase tracking-widest text-white/70">
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Scroll cue */}
        <div
          className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/70"
          style={{ opacity: Math.max(0, 1 - scrollY / 200) }}
        >
          <span className="text-[10px] uppercase tracking-[0.3em]">Scroll</span>
          <div className="w-px h-10 bg-linear-to-b from-white/70 to-transparent animate-pulse" />
        </div>
      </div>

      {/* Mobile nav + rail/content grid share a parent so sticky works */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6">
        <MobileNav active={activeSection} onSelect={scrollToSection} />

        <div className="lg:grid lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-14">
          {/* Vertical rail (desktop only) */}
          <aside className="hidden lg:block pt-12 sm:pt-16">
            <SideNav active={activeSection} onSelect={scrollToSection} />
          </aside>

          <div className="min-w-0">
            {/* Community section (on-property amenities) */}
            <div className="pt-12 sm:pt-16">
              <div id="section-community">
                <CommunitySection communities={COMMUNITIES} />
              </div>
            </div>

            {/* Category sections + parallax dividers */}
            <div className="py-12 sm:py-16 space-y-16 sm:space-y-20">
              {interleaved.map((item, i) => {
                if (item.type === "category") {
                  const num =
                    CATEGORIES.findIndex((c) => c.key === item.cat.key) + 2;
                  return (
                    <div key={item.cat.key} id={`section-${item.cat.key}`}>
                      <CategorySection category={item.cat} num={num} />
                    </div>
                  );
                }
                return <ParallaxDivider key={`div-${i}`} divider={item.div} />;
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Footer CTA */}
      <Separator />
      <div className="relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.08] pointer-events-none"
          style={{
            backgroundImage: `url(${img("photo-1469474968028-56623f02e42e", 1600)})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-20 text-center space-y-5">
          <Reveal>
            <Compass className="h-8 w-8 mx-auto text-muted-foreground" strokeWidth={1.5} />
          </Reveal>
          <Reveal delay={80}>
            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight">
              Ready to explore?
            </h2>
          </Reveal>
          <Reveal delay={140}>
            <p className="text-muted-foreground max-w-lg mx-auto text-base leading-relaxed">
              These are just our favorites — the Poconos has endless things to
              discover. Ask us for personalized recommendations during your stay.
            </p>
          </Reveal>
          <Reveal delay={200}>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-3">
              <Button size="lg" className="gap-2" render={<Link href="/" />}>
                <ArrowLeft className="h-4 w-4" />
                Back to Home
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="gap-2"
                render={<Link href="/why-summit" />}
              >
                Why Summit?
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </Reveal>
        </div>
      </div>

      <PhotoCredits credits={IMAGE_CREDITS} />
      <SiteFooter />
    </div>
  );
}
