"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import {
  clearGuestToken,
} from "@/lib/guest-session";
import { InstagramFeedSection } from "@/components/guest/instagram-feed";
import { ReviewsCarousel } from "@/components/guest/reviews-carousel";
import { REVIEWS, REVIEW_STATS } from "@/lib/reviews-data";
import { ThemeToggle } from "@/components/theme-toggle";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import {
  CountUp,
  EveningInterlude,
  SeasonsExplorer,
  StoryBand,
} from "@/components/home/story";
import {
  Search,
  MapPin,
  Calendar,
  Users,
  ChevronLeft,
  ChevronRight,
  Clock,
  DoorOpen,
  DoorClosed,
  Star,
  ArrowRight,
  Mountain,
  Waves,
  Flame,
  PartyPopper,
  HeartHandshake,
  Snowflake,
  UtensilsCrossed,
  TreePine,
  Dices,
  Tent,
  Check,
  BadgeCheck,
  ShieldCheck,
  KeyRound,
} from "lucide-react";



/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Property = {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  description: string | null;
  cover_image_url: string | null;
  max_guests: number | null;
};

type Reservation = {
  id: string;
  check_in_date: string;
  check_out_date: string;
  num_guests: number;
  status: string;
  signature_url: string | null;
  property: {
    id: string;
    name: string;
    slug: string;
    address: string | null;
    cover_image_url: string | null;
    timezone: string;
  };
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatShortDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function getDaysUntil(dateStr: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.ceil(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
}

function getNightCount(checkIn: string, checkOut: string) {
  const d1 = new Date(checkIn + "T00:00:00");
  const d2 = new Date(checkOut + "T00:00:00");
  return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

/* ------------------------------------------------------------------ */
/*  Shared layout primitives                                          */
/* ------------------------------------------------------------------ */

/** One consistent header treatment for every section: a small uppercase
 *  eyebrow, a tight display heading, and an optional lede. Used everywhere
 *  so the page reads with a single typographic rhythm. */
function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "left",
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "left" | "center";
}) {
  return (
    <div
      className={
        align === "center"
          ? "mx-auto max-w-2xl text-center"
          : "max-w-2xl"
      }
    >
      {eyebrow && (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          <span className="h-1 w-1 rounded-full bg-primary" />
          {eyebrow}
        </span>
      )}
      <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-balance">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-2.5 text-base sm:text-lg text-muted-foreground text-pretty">
          {subtitle}
        </p>
      )}
    </div>
  );
}

/** Credibility strip — real, scraped review stats. Funded sites lead with
 *  proof; this turns 837 reviews into an at-a-glance signal. */
function TrustBar() {
  const stats = [
    {
      icon: Star,
      value: <CountUp value={REVIEW_STATS.averageRating} decimals={2} />,
      label: "Average guest rating",
    },
    {
      icon: BadgeCheck,
      value: <CountUp value={REVIEW_STATS.totalCount} suffix="+" />,
      label: "Verified reviews",
    },
    {
      icon: KeyRound,
      value: <CountUp value={REVIEW_STATS.propertyCount} duration={800} />,
      label: "Lakefront homes",
    },
    {
      icon: ShieldCheck,
      value: "Book direct",
      label: "No platform fees",
    },
  ];
  return (
    <section className="border-y bg-card">
      <div className="mx-auto grid max-w-6xl grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0">
        {stats.map(({ icon: Icon, value, label }) => (
          <div
            key={label}
            className="flex flex-col items-center gap-1 px-4 py-6 text-center sm:py-8"
          >
            <Icon
              className={`h-5 w-5 ${
                Icon === Star
                  ? "fill-amber-400 text-amber-400"
                  : "text-primary"
              }`}
            />
            <div className="text-xl sm:text-2xl font-bold tracking-tight">
              {value}
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground">
              {label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Session helpers (reused from main page)                            */
/* ------------------------------------------------------------------ */

const SESSION_KEY = "guest-portal-session";

function loadSession(): {
  guestName: string;
  reservation: Reservation;
} | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Hero images — lifestyle shots from summitlakeside.com              */
/* ------------------------------------------------------------------ */

const HERO_IMAGES = [
  {
    url: "/videos/fire.mp4",
    alt: "Fire pit",
    type: "video" as const,
    poster: "/videos/fire.jpg",
  },
  {
    url: "/videos/interior.mp4",
    alt: "Interior",
    type: "video" as const,
    poster: "/videos/interior.jpg",
  },
  {
    url: "/videos/bml.mp4",
    alt: "Big Bass Lake",
    type: "video" as const,
    poster: "/videos/bml.jpg",
  },
  {
    url: "/videos/bushkill-falls.mp4",
    alt: "Bushkill Falls",
    type: "video" as const,
    poster: "/videos/bushkill-falls.jpg",
  },
  {
    url: "/videos/sauna-swing.mp4",
    alt: "Sauna and swing",
    type: "video" as const,
    poster: "/videos/sauna-swing.jpg",
  },
  {
    url: "/videos/boatlake.mp4",
    alt: "Boat on the lake",
    type: "video" as const,
    poster: "/videos/boatlake.jpg",
  },
  {
    url: "/videos/biancas.mp4",
    alt: "Bianca's",
    type: "video" as const,
    poster: "/videos/biancas.jpg",
  },
];

/* ------------------------------------------------------------------ */
/*  Carousel data                                                      */
/* ------------------------------------------------------------------ */

const EXPLORE_POCONOS = [
  {
    title: "Book Your Bachelorette Party",
    image:
      "https://images.unsplash.com/photo-1529543544282-ea6407407db9?auto=format&fit=crop&w=800&q=80",
    icon: PartyPopper,
    gradient: "from-pink-600/80 to-purple-700/80",
    href: "/things-to-do#section-entertainment",
  },
  {
    title: "Gather 'Round the Fire",
    image:
      "https://images.unsplash.com/photo-1475483768296-6163e08872a1?auto=format&fit=crop&w=800&q=80",
    icon: Flame,
    gradient: "from-orange-600/80 to-red-700/80",
    href: "/things-to-do#section-community",
  },
  {
    title: "Plan a Ski Trip",
    image:
      "https://images.unsplash.com/photo-1551524559-8af4e6624178?auto=format&fit=crop&w=800&q=80",
    icon: Snowflake,
    gradient: "from-sky-600/80 to-blue-800/80",
    href: "/things-to-do#section-winter",
  },
  {
    title: "Get Out on the Lake",
    image:
      "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80",
    icon: Waves,
    gradient: "from-cyan-600/80 to-teal-700/80",
    href: "/things-to-do#section-water",
  },
  {
    title: "Take a Wellness Retreat",
    image:
      "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80",
    icon: HeartHandshake,
    gradient: "from-emerald-600/80 to-green-800/80",
    href: "/things-to-do#section-wellness",
  },
];

const LOCAL_HIGHLIGHTS = [
  {
    title: "Grab a Bite to Eat",
    image:
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=800&q=80",
    icon: UtensilsCrossed,
    gradient: "from-amber-600/80 to-orange-700/80",
    href: "/things-to-do#section-dining",
  },
  {
    title: "Check Out Local Ski Areas",
    image:
      "https://images.unsplash.com/photo-1565992441121-4367c2967103?auto=format&fit=crop&w=800&q=80",
    icon: Mountain,
    gradient: "from-slate-600/80 to-blue-800/80",
    href: "/things-to-do#section-winter",
  },
  {
    title: "Get in Touch with Nature",
    image:
      "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=800&q=80",
    icon: TreePine,
    gradient: "from-green-700/80 to-emerald-900/80",
    href: "/things-to-do#section-outdoor",
  },
  {
    title: "Casino Night",
    image:
      "https://images.unsplash.com/photo-1596838132731-3301c3fd4317?auto=format&fit=crop&w=800&q=80",
    icon: Dices,
    gradient: "from-violet-700/80 to-purple-900/80",
    href: "/things-to-do#section-entertainment",
  },
  {
    title: "Go Camping & Glamping",
    image:
      "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=800&q=80",
    icon: Tent,
    gradient: "from-yellow-700/80 to-amber-900/80",
    href: "/things-to-do#section-adventure",
  },
];

/* ------------------------------------------------------------------ */
/*  Instagram feed — curated photos from @summitlakeside               */
/* ------------------------------------------------------------------ */


/* ------------------------------------------------------------------ */
/*  Auto-rotating Carousel                                             */
/* ------------------------------------------------------------------ */

function Carousel({
  items,
  title,
  subtitle,
}: {
  items: {
    title: string;
    image: string;
    icon: React.ComponentType<{ className?: string }>;
    gradient: string;
    href?: string;
  }[];
  title: string;
  subtitle?: string;
}) {
  const [current, setCurrent] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);

  const startAutoPlay = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setCurrent((prev) => (prev + 1) % items.length);
    }, 4000);
  }, [items.length]);

  useEffect(() => {
    startAutoPlay();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [startAutoPlay]);

  useEffect(() => {
    if (scrollRef.current) {
      const cardWidth = 280 + 16; // card width + gap
      scrollRef.current.scrollTo({
        left: current * cardWidth,
        behavior: "smooth",
      });
    }
  }, [current]);

  const goTo = (index: number) => {
    setCurrent(index);
    startAutoPlay();
  };

  const cardClass =
    "group relative flex-shrink-0 w-[280px] sm:w-[300px] h-[200px] rounded-2xl overflow-hidden snap-start ring-1 ring-black/5 shadow-sm transition-shadow hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <section className="space-y-5">
      <div className="px-4 sm:px-6">
        <SectionHeading title={title} subtitle={subtitle} />
      </div>

      <div className="relative">
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide px-4 sm:px-6 pb-2"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          onMouseEnter={() => {
            if (intervalRef.current) clearInterval(intervalRef.current);
          }}
          onMouseLeave={startAutoPlay}
        >
          {items.map((item, i) => {
            const Icon = item.icon;
            const inner = (
              <>
                <div className="absolute inset-0 bg-muted" />
                <img
                  src={item.image}
                  alt={item.title}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                {/* One consistent scrim across every card — no per-category rainbow */}
                <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute inset-0 flex flex-col justify-end p-5">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm ring-1 ring-white/20">
                      <Icon className="h-4 w-4 text-white" />
                    </span>
                    <span className="text-white font-semibold text-base text-left leading-tight text-balance">
                      {item.title}
                    </span>
                    <ChevronRight className="ml-auto h-4 w-4 text-white/0 transition-all group-hover:text-white/90 group-hover:translate-x-0.5" />
                  </div>
                </div>
              </>
            );

            return item.href ? (
              <Link key={i} href={item.href} className={cardClass}>
                {inner}
              </Link>
            ) : (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={cardClass}
              >
                {inner}
              </button>
            );
          })}
        </div>

        {/* Dots indicator */}
        <div className="flex justify-center gap-1.5 mt-3">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === current
                  ? "w-6 bg-foreground"
                  : "w-1.5 bg-foreground/20 hover:bg-foreground/40"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Site Navigation                                                    */
/* ------------------------------------------------------------------ */


/* ------------------------------------------------------------------ */
/*  Availability Search Form (navigates to /search)                    */
/* ------------------------------------------------------------------ */

function AvailabilitySearch() {
  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState(tomorrow);
  const [guests, setGuests] = useState(2);
  const [pets, setPets] = useState(0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!checkIn || !checkOut) return;
    const params = new URLSearchParams({
      check_in: checkIn,
      check_out: checkOut,
      guests: String(guests),
      pets: String(pets),
    });
    window.location.href = `/search?${params}`;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_6rem_5rem_auto] rounded-2xl overflow-hidden bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl shadow-black/20">
        <div className="grid grid-cols-2 sm:contents border-b sm:border-b-0 border-white/15">
        <div className="px-4 sm:px-6 py-2.5 sm:py-3.5 border-r border-white/15 hover:bg-white/5 transition-colors">
          <label htmlFor="v2-checkin" className="block text-xs font-semibold text-white/60 mb-0 sm:mb-1 tracking-wide text-center sm:text-left">
            Check-in
          </label>
          <input
            id="v2-checkin"
            type="date"
            min={today}
            value={checkIn}
            onChange={(e) => {
              setCheckIn(e.target.value);
              if (checkOut && e.target.value >= checkOut) setCheckOut("");
            }}
            className="w-full bg-transparent text-white text-base sm:text-lg font-medium outline-none scheme-dark text-center sm:text-left max-sm:[&::-webkit-datetime-edit]:justify-center max-sm:[&::-webkit-date-and-time-value]:text-center"
            required
          />
        </div>
        <div className="px-4 sm:px-6 py-2.5 sm:py-3.5 sm:border-r border-white/15 hover:bg-white/5 transition-colors">
          <label htmlFor="v2-checkout" className="block text-xs font-semibold text-white/60 mb-0 sm:mb-1 tracking-wide text-center sm:text-left">
            Check-out
          </label>
          <input
            id="v2-checkout"
            type="date"
            min={checkIn ? new Date(new Date(checkIn + "T00:00:00").getTime() + 86400000).toISOString().split("T")[0] : tomorrow}
            value={checkOut}
            onChange={(e) => {
              const val = e.target.value;
              if (checkIn && val <= checkIn) return;
              setCheckOut(val);
            }}
            className="w-full bg-transparent text-white text-base sm:text-lg font-medium outline-none scheme-dark text-center sm:text-left max-sm:[&::-webkit-datetime-edit]:justify-center max-sm:[&::-webkit-date-and-time-value]:text-center"
            required
          />
        </div>
        </div>
        <div className="grid grid-cols-[1fr_1fr_auto] sm:contents border-white/15">
        <div className="px-4 sm:px-6 py-2.5 sm:py-3.5 border-r border-white/15 hover:bg-white/5 transition-colors">
          <label htmlFor="v2-guests" className="block text-xs font-semibold text-white/60 mb-0 sm:mb-1 tracking-wide text-center sm:text-left">
            Guests
          </label>
          <input
            id="v2-guests"
            type="number"
            min={1}
            max={30}
            value={guests}
            onChange={(e) => setGuests(parseInt(e.target.value) || 1)}
            className="w-full bg-transparent text-white text-base sm:text-lg font-medium outline-none scheme-dark text-center sm:text-left"
          />
        </div>
        <div className="px-4 sm:px-6 py-2.5 sm:py-3.5 border-r border-white/15 hover:bg-white/5 transition-colors">
          <label htmlFor="v2-pets" className="block text-xs font-semibold text-white/60 mb-0 sm:mb-1 tracking-wide text-center sm:text-left">
            Pets
          </label>
          <input
            id="v2-pets"
            type="number"
            min={0}
            max={3}
            value={pets}
            onChange={(e) => setPets(parseInt(e.target.value) || 0)}
            className="w-full bg-transparent text-white text-base sm:text-lg font-medium outline-none scheme-dark text-center sm:text-left"
          />
        </div>
        <div className="flex items-center justify-center p-2">
          <button
            type="submit"
            aria-label="Search"
            className="bg-white/20 hover:bg-white/30 text-white transition-colors flex items-center justify-center rounded-xl border border-white/20 w-12 h-12"
          >
            <Search className="h-5 w-5" />
          </button>
        </div>
        </div>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Trip Summary Card (logged-in guest)                                */
/* ------------------------------------------------------------------ */

function TripSummaryCard({ reservation }: { reservation: Reservation }) {
  const daysUntil = getDaysUntil(reservation.check_in_date);
  const nights = getNightCount(
    reservation.check_in_date,
    reservation.check_out_date
  );

  const countdownLabel =
    daysUntil === 0
      ? "Today!"
      : daysUntil === 1
        ? "Tomorrow!"
        : daysUntil > 0
          ? `${daysUntil} days away`
          : "In progress";

  return (
    <Link href="/checkin" className="block">
      <Card className="overflow-hidden border-primary/20 hover:border-primary/40 transition-colors">
        <div className="flex">
          {reservation.property.cover_image_url && (
            <div className="relative w-28 sm:w-36 flex-shrink-0">
              <img
                src={reservation.property.cover_image_url}
                alt={reservation.property.name}
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>
          )}
          <div className="flex-1 p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-base leading-tight">
                  {reservation.property.name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {nights} night{nights !== 1 ? "s" : ""} &middot;{" "}
                  {reservation.num_guests} guest
                  {reservation.num_guests !== 1 ? "s" : ""}
                </p>
              </div>
              <Badge
                variant="secondary"
                className="text-xs shrink-0 whitespace-nowrap"
              >
                <Clock className="h-3 w-3 mr-1" />
                {countdownLabel}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <DoorOpen className="h-3.5 w-3.5" />
                {formatShortDate(reservation.check_in_date)}
              </div>
              <ArrowRight className="h-3 w-3" />
              <div className="flex items-center gap-1.5">
                <DoorClosed className="h-3.5 w-3.5" />
                {formatShortDate(reservation.check_out_date)}
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-primary font-medium">
              Manage Booking
              <ChevronRight className="h-4 w-4" />
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Property Card                                                      */
/* ------------------------------------------------------------------ */

/** How many photos the card carousel pages through before the
 *  "click to view more" overlay slide. */
const CARD_PHOTO_COUNT = 8;

function PropertyCardCarousel({
  property,
  photos,
}: {
  property: Property;
  photos: string[];
}) {
  const [index, setIndex] = useState(0);
  // Only mount <img> tags up to one slide ahead of the furthest one viewed,
  // so 5 cards × 9 photos don't all load on page load.
  const [maxLoaded, setMaxLoaded] = useState(0);
  const touchStart = useRef<number | null>(null);

  const slides = photos.slice(0, CARD_PHOTO_COUNT);
  const overlayPhoto = photos.length > CARD_PHOTO_COUNT ? photos[CARD_PHOTO_COUNT] : null;
  const slideCount = slides.length + (overlayPhoto ? 1 : 0);

  const goTo = (next: number) => {
    const clamped = (next + slideCount) % slideCount;
    setIndex(clamped);
    setMaxLoaded((m) => Math.max(m, clamped + 1));
  };

  return (
    <div
      className="relative h-full overflow-hidden"
      onTouchStart={(e) => {
        touchStart.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchStart.current === null) return;
        const delta = e.changedTouches[0].clientX - touchStart.current;
        touchStart.current = null;
        if (Math.abs(delta) < 40) return;
        goTo(delta < 0 ? index + 1 : index - 1);
      }}
    >
      <div
        className="flex h-full transition-transform duration-300 ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {slides.map((url, i) => (
          <div key={i} className="relative h-full w-full shrink-0 bg-muted">
            {i <= maxLoaded && (
              <img
                src={url}
                alt={`${property.name} — photo ${i + 1}`}
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
          </div>
        ))}
        {overlayPhoto && (
          <div className="relative h-full w-full shrink-0 bg-muted">
            {slides.length <= maxLoaded && (
              <img
                src={overlayPhoto}
                alt={`${property.name} — more photos`}
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <span className="text-white text-sm font-semibold tracking-wide">
                Click to view more
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Arrows — hidden until the card is hovered */}
      {slideCount > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous photo"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              goTo(index - 1);
            }}
            className="absolute left-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-foreground shadow-md opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity hover:bg-white"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Next photo"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              goTo(index + 1);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-foreground shadow-md opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity hover:bg-white"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          {/* Dots */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {Array.from({ length: slideCount }).map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === index ? "w-3 bg-white" : "w-1.5 bg-white/50"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function PropertyCard({
  property,
  bookingQuery,
  photos,
}: {
  property: Property;
  bookingQuery?: { checkIn: string; checkOut: string; guests: number } | null;
  photos?: string[];
}) {
  const nights = bookingQuery
    ? getNightCount(bookingQuery.checkIn, bookingQuery.checkOut)
    : null;

  const bookUrl = bookingQuery
    ? `/book/${property.slug}?check_in=${bookingQuery.checkIn}&check_out=${bookingQuery.checkOut}&guests=${bookingQuery.guests}`
    : `/book/${property.slug}`;

  return (
    <Link href={bookUrl} className="block">
      <Card className="pt-0 overflow-hidden group ring-1 ring-border/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:ring-border">
        <div className="relative h-48 sm:h-56">
          {photos && photos.length > 0 ? (
            <PropertyCardCarousel property={property} photos={photos} />
          ) : property.cover_image_url ? (
            <img
              src={property.cover_image_url}
              alt={property.name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <Mountain className="h-12 w-12 text-muted-foreground/30" />
            </div>
          )}
          <div className="absolute top-3 right-3 flex gap-2">
            {bookingQuery && (
              <Badge className="bg-green-600 text-white border-0">
                Available
              </Badge>
            )}
            {property.max_guests && (
              <Badge
                variant="secondary"
                className="bg-black/60 text-white border-0 backdrop-blur-sm"
              >
                <Users className="h-3 w-3 mr-1" />
                Up to {property.max_guests}
              </Badge>
            )}
          </div>
        </div>
        <CardContent className="p-4 space-y-2">
          <h3 className="font-semibold text-lg">{property.name}</h3>
          {property.address && (() => {
            const parts = property.address.split(",").map(p => p.trim());
            const general = parts.length >= 3 ? parts.slice(-3, -1).join(", ") : parts.length >= 2 ? parts.slice(-2).join(", ") : parts[0];
            return general ? (
              <p className="text-sm text-muted-foreground flex items-start gap-1.5">
                <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span className="line-clamp-1">{general}</span>
              </p>
            ) : null;
          })()}
          {/* Review rating */}
          {(() => {
            const propertyReviews = REVIEWS.filter(
              (r) => r.property === property.name
            );
            if (propertyReviews.length === 0) return null;
            const avg =
              propertyReviews.reduce((s, r) => s + r.rating, 0) /
              propertyReviews.length;
            return (
              <div className="flex items-center gap-1.5 text-sm">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                <span className="font-medium">{avg.toFixed(1)}</span>
                <span className="text-muted-foreground">
                  ({propertyReviews.length} review
                  {propertyReviews.length !== 1 ? "s" : ""})
                </span>
              </div>
            );
          })()}
          {property.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {/* Lodgify descriptions arrive as HTML — show plain text */}
              {property.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()}
            </p>
          )}
          {bookingQuery && nights && (
            <p className="text-sm font-medium">
              {nights} night{nights !== 1 ? "s" : ""} &middot;{" "}
              {formatShortDate(bookingQuery.checkIn)} &ndash;{" "}
              {formatShortDate(bookingQuery.checkOut)}
            </p>
          )}
          <div
            className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-colors w-full mt-3 h-10 px-3 ${
              bookingQuery
                ? "bg-primary text-primary-foreground group-hover:bg-primary/90"
                : "border border-input bg-background group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary"
            }`}
          >
            <Calendar className="h-4 w-4" />
            {bookingQuery ? "Book Now" : "View Availability"}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function HomeV2Page() {
  const [heroIndex, setHeroIndex] = useState(0);
  const heroIndexRef = useRef(0);
  const heroTouchStart = useRef<number | null>(null);
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [session, setSession] = useState<{
    guestName: string;
    reservation: Reservation;
  } | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyPhotos, setPropertyPhotos] = useState<
    Record<string, string[]>
  >({});
  const [loaded, setLoaded] = useState(false);

  // Rotate hero slides — images advance on a timer, videos advance on ended.
  // When autoplay is blocked (iOS Low Power Mode / data-saver), videos never
  // fire `ended`, so advance their poster frames on the timer too.
  useEffect(() => {
    const current = HERO_IMAGES[heroIndex];
    if ("type" in current && current.type === "video" && !autoplayBlocked)
      return;
    const timer = setTimeout(() => {
      setHeroIndex((prev) => (prev + 1) % HERO_IMAGES.length);
    }, 6000);
    return () => clearTimeout(timer);
  }, [heroIndex, autoplayBlocked]);

  // Skip the active video on first run — autoPlay handles it; a programmatic
  // seek + .play() during the autoplay hand-off breaks mobile Safari.
  const didMountRef = useRef(false);
  useEffect(() => {
    heroIndexRef.current = heroIndex;
    const isFirstRun = !didMountRef.current;
    didMountRef.current = true;
    videoRefs.current.forEach((video, i) => {
      if (!video) return;
      if (i === heroIndex) {
        if (isFirstRun) return;
        video.currentTime = 0;
        video.play().catch(() => setAutoplayBlocked(true));
      } else {
        video.pause();
      }
    });
  }, [heroIndex]);

  // Probe whether WebKit blocked the initial autoplay (Low Power Mode,
  // data-saver). No seek here — joining an in-flight autoplay is safe, only
  // seek+play during the hand-off is not.
  useEffect(() => {
    const timer = setTimeout(() => {
      const video = videoRefs.current[heroIndexRef.current];
      if (!video || !video.paused) return;
      video.play().catch(() => setAutoplayBlocked(true));
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  // Any user gesture lifts the autoplay block — resume the live video.
  useEffect(() => {
    if (!autoplayBlocked) return;
    const resume = () => {
      const video = videoRefs.current[heroIndexRef.current];
      if (!video) return;
      video
        .play()
        .then(() => setAutoplayBlocked(false))
        .catch(() => {});
    };
    window.addEventListener("touchend", resume, { passive: true });
    window.addEventListener("click", resume);
    return () => {
      window.removeEventListener("touchend", resume);
      window.removeEventListener("click", resume);
    };
  }, [autoplayBlocked]);

  // Load session + fetch data
  useEffect(() => {
    const existing = loadSession();
    if (existing) setSession(existing);
    setLoaded(true);

    const supabase = createClient();

    // Fetch properties
    supabase
      .from("property")
      .select("id, name, slug, address, description, cover_image_url, max_guests")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        if (data) setProperties(data);
      });

    // Fetch photo galleries for the property card carousels
    fetch("/api/property-photos")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.photos) setPropertyPhotos(data.photos);
      })
      .catch(() => {});
  }, []);

  if (!loaded) return null;

  return (
    <div className="min-h-screen flex flex-col font-(family-name:--font-plus-jakarta)">
      {/* ============================================================ */}
      {/*  HERO + BOOKING SEARCH                                       */}
      {/* ============================================================ */}
      <section
        className="relative min-h-screen flex flex-col"
        onTouchStart={(e) => { heroTouchStart.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (heroTouchStart.current === null) return;
          const delta = e.changedTouches[0].clientX - heroTouchStart.current;
          if (Math.abs(delta) > 50) {
            setHeroIndex((prev) =>
              delta < 0
                ? (prev + 1) % HERO_IMAGES.length
                : (prev - 1 + HERO_IMAGES.length) % HERO_IMAGES.length
            );
          }
          heroTouchStart.current = null;
        }}
      >
        {/* Background images with crossfade */}
        {HERO_IMAGES.map((img, i) => (
          <div
            key={i}
            className="absolute inset-0 transition-opacity duration-1000"
            style={{ opacity: i === heroIndex ? 1 : 0 }}
          >
            {"type" in img && img.type === "video" ? (
              <video
                ref={(el) => {
                  videoRefs.current[i] = el;
                  if (el) {
                    // React sets `muted` as a property only; WebKit's
                    // autoplay policy wants the attribute too.
                    el.muted = true;
                    el.defaultMuted = true;
                  }
                }}
                src={img.url}
                poster={img.poster}
                muted
                autoPlay
                playsInline
                preload={
                  i === heroIndex || i === (heroIndex + 1) % HERO_IMAGES.length
                    ? "auto"
                    : "none"
                }
                onEnded={() =>
                  setHeroIndex((prev) => (prev + 1) % HERO_IMAGES.length)
                }
                className="bg-video w-full h-full object-cover"
              />
            ) : (
              <img
                src={img.url}
                alt={img.alt}
                className="w-full h-full object-cover"
              />
            )}
          </div>
        ))}
        <div className="absolute inset-0 bg-linear-to-b from-black/60 via-black/35 to-black/80" />
        <div className="absolute inset-0 bg-radial-[at_50%_30%] from-transparent to-black/40" />

        {/* Floating Nav */}
        <SiteNav variant="transparent" />

        {/* Hero content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-6 text-center">
          {/* Trust pill — real rating, surfaced before the fold */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 backdrop-blur-md">
            <span className="flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              ))}
            </span>
            <span className="text-sm font-medium text-white">
              {REVIEW_STATS.averageRating.toFixed(2)}
            </span>
            <span className="text-sm text-white/70">
              · {REVIEW_STATS.totalCount.toLocaleString()}+ verified reviews
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white tracking-tight max-w-3xl leading-[1.05] text-balance">
            Your Poconos lakehouse, booked direct
          </h1>
          <p className="mt-4 text-lg sm:text-xl text-white/85 max-w-xl text-pretty">
            Lakefront homes with hot tubs, saunas, game rooms, and private
            water access — no platform fees, no markup.
          </p>

          {/* Booking search card — the hero is always the marketing CTA, even
              for returning guests. Their trip card lives below the hero. */}
          <div className="mt-10 w-full max-w-2xl">
            <AvailabilitySearch />
          </div>

          {/* Already booked? */}
          <p className="mt-4 text-white/60 text-sm">
            Already booked?{" "}
            <Link
              href="/checkin"
              className="text-white underline underline-offset-4 hover:text-white/90"
            >
              Find your reservation and check in
            </Link>
          </p>
        </div>

        {/* Hero dots */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex gap-1.5">
          {HERO_IMAGES.map((_, i) => (
            <button
              key={i}
              onClick={() => setHeroIndex(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === heroIndex
                  ? "w-6 bg-white"
                  : "w-1.5 bg-white/40 hover:bg-white/60"
              }`}
            />
          ))}
        </div>
      </section>

      {/* ============================================================ */}
      {/*  TRUST BAR — credibility strip from real review stats        */}
      {/* ============================================================ */}
      <TrustBar />

      {/* ============================================================ */}
      {/*  TRIP SUMMARY (shown below hero when logged in)               */}
      {/* ============================================================ */}
      {session && (
        <section className="px-4 sm:px-6 py-8 max-w-4xl mx-auto w-full">
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">
                Welcome back,{" "}
                {(session.guestName || "").split(" ")[0] || "Guest"}!
              </h2>
              <p className="text-muted-foreground text-sm">
                Your upcoming trip is all set — manage your booking, complete
                registration, or browse add-ons below.
              </p>
            </div>
            <TripSummaryCard reservation={session.reservation} />
          </div>
        </section>
      )}



      {/* ============================================================ */}
      {/*  OUR HOMES                                                    */}
      {/* ============================================================ */}
      {properties.length > 0 && (
        <section className="px-4 sm:px-6 py-16 sm:py-20 max-w-6xl mx-auto w-full">
          <div className="mb-8">
            <SectionHeading
              eyebrow="The Collection"
              title="Our lakehouses"
              subtitle="Handpicked retreats on private Pocono Mountain lakes — each with hot tubs, boats, and direct water access."
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {properties.map((property) => (
              <PropertyCard
                key={property.id}
                property={property}
                photos={propertyPhotos[property.id]}
              />
            ))}
          </div>
        </section>
      )}

      {/* ============================================================ */}
      {/*  THE SUMMIT STANDARD — full-bleed parallax band               */}
      {/* ============================================================ */}
      <StoryBand
        img="https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-588691/airbnb/10-living-room-3-image-3.jpg"
        alt="Living room with a stone fireplace and black steel staircase"
      >
        <div className="max-w-xl">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.3em] text-white/70">
            <span className="h-1 w-1 rounded-full bg-white/70" />
            The Summit Standard
          </span>
          <h2 className="mt-4 text-4xl sm:text-6xl font-bold tracking-tight text-white text-balance [text-shadow:0_1px_24px_rgb(0_0_0/0.45)]">
            An upscale stay, down to the detail.
          </h2>
          <p className="mt-5 text-lg text-white/85 leading-relaxed text-pretty [text-shadow:0_1px_16px_rgb(0_0_0/0.5)]">
            Every lakehouse is newly renovated and thoughtfully furnished —
            gourmet kitchens, hot tubs, and private outdoor space, stocked
            before you arrive.
          </p>
          <div className="mt-7 flex flex-wrap gap-2">
            {[
              "Stocked linens & towels",
              "Full kitchen essentials",
              "Toiletries provided",
              "Games & toys",
              "Plush blankets",
              "Boats & kayaks",
              "Newly renovated",
              "Self check-in",
            ].map((amenity) => (
              <span
                key={amenity}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-sm text-white/90 backdrop-blur-sm"
              >
                <Check className="h-3.5 w-3.5 text-white/80" />
                {amenity}
              </span>
            ))}
          </div>
        </div>
      </StoryBand>

      {/* ============================================================ */}
      {/*  ONE LAKE, FOUR SEASONS — interactive explorer                */}
      {/* ============================================================ */}
      <SeasonsExplorer />

      {/* ============================================================ */}
      {/*  PET FRIENDLY                                                  */}
      {/* ============================================================ */}
      <StoryBand
        img="https://a0.muscache.com/im/pictures/370a991e-fefb-4218-8083-a52775bc931a.jpg?im_w=1920"
        alt="Pet friendly lakefront property"
        minHeight="min-h-[55vh] sm:min-h-[60vh]"
      >
        <div className="max-w-lg space-y-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.3em] text-white/80">
            <span className="h-1 w-1 rounded-full bg-white/80" />
            Pet friendly
          </span>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white leading-[1.02] text-balance [text-shadow:0_1px_24px_rgb(0_0_0/0.45)]">
            No need for a dog sitter.
          </h2>
          <p className="text-lg sm:text-xl text-white/90 font-medium text-pretty [text-shadow:0_1px_16px_rgb(0_0_0/0.5)]">
            Every Summit Lakeside home welcomes pets — so the whole family
            comes along.
          </p>
        </div>
      </StoryBand>

      {/* ============================================================ */}
      {/*  GUEST REVIEWS                                                */}
      {/* ============================================================ */}
      <Separator className="max-w-6xl mx-auto" />
      <ReviewsCarousel />

      {/* ============================================================ */}
      {/*  AFTER DARK — fire video interlude                            */}
      {/* ============================================================ */}
      <EveningInterlude />

      {/* ============================================================ */}
      {/*  EXPLORE POCONOS CAROUSEL                                     */}
      {/* ============================================================ */}
      <div className="py-16 sm:py-20 max-w-6xl mx-auto w-full">
        <Carousel
          items={EXPLORE_POCONOS}
          title="Explore the Poconos"
          subtitle="Find your perfect mountain escape"
        />
      </div>

      <Separator className="max-w-6xl mx-auto" />

      {/* ============================================================ */}
      {/*  LOCAL HIGHLIGHTS CAROUSEL                                    */}
      {/* ============================================================ */}
      <div className="py-16 sm:py-20 max-w-6xl mx-auto w-full">
        <Carousel
          items={LOCAL_HIGHLIGHTS}
          title="Things to Do Nearby"
          subtitle="Discover the best the Poconos has to offer"
        />
      </div>

      {/* ============================================================ */}
      {/*  INSTAGRAM FEED                                               */}
      {/* ============================================================ */}
      <Separator className="max-w-6xl mx-auto" />
      <InstagramFeedSection />

      <SiteFooter />
    </div>
  );
}
