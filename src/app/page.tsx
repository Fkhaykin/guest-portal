"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
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
import { GuestPhotoCarousel } from "@/components/guest/guest-photo-carousel";
import { InstagramFeedSection } from "@/components/guest/instagram-feed";
import { ReviewsCarousel } from "@/components/guest/reviews-carousel";
import { REVIEWS } from "@/lib/reviews-data";
import { ThemeToggle } from "@/components/theme-toggle";
import { SiteNav } from "@/components/site-nav";
import {
  Search,
  MapPin,
  Calendar,
  Users,
  ChevronRight,
  Clock,
  DoorOpen,
  DoorClosed,
  Star,
  ArrowRight,
  Sparkles,
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

type Promotion = {
  id: string;
  title: string;
  description: string | null;
  promo_code: string | null;
  discount_percent: number | null;
  discount_amount: number | null;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
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
    url: "https://a0.muscache.com/im/pictures/f5f31bab-faec-4b26-b3c9-cb356293126a.jpg?im_w=1200",
    alt: "Lakefront Mansion — exterior",
  },
  {
    url: "https://a0.muscache.com/im/pictures/6e8e7f2f-dd7b-4e29-8719-6e0d6ab78688.jpg?im_w=1200",
    alt: "Lakefront Home — exterior",
  },
  {
    url: "https://a0.muscache.com/im/pictures/ca104183-2a19-4800-99d2-4b34ba9ea23c.jpg?im_w=1200",
    alt: "Cozy Lakehouse — exterior",
  },
  {
    url: "https://a0.muscache.com/im/pictures/2a8bbc05-e02f-48e0-93b9-fe37adeaee3a.jpg?im_w=1200",
    alt: "Pet Friendly Lakeview — exterior",
  },
  {
    url: "https://a0.muscache.com/im/pictures/bb8633bf-fe15-4b03-84a4-d5174bea0515.jpg?im_w=1200",
    alt: "Luxury Lakeview Cabin — exterior",
  },
  {
    url: "https://a0.muscache.com/im/pictures/1f3f8cb2-8db6-450c-93de-1404b66853df.jpg?im_w=1200",
    alt: "Lakefront Mansion — lakeside view",
  },
  {
    url: "https://a0.muscache.com/im/pictures/a6f5d463-483e-4670-98c7-248dde3c46b5.jpg?im_w=1200",
    alt: "Cozy Lakehouse — lake view",
  },
  {
    url: "https://a0.muscache.com/im/pictures/5e71465d-8c6e-426b-9717-3bc0b117bdbf.jpg?im_w=1200",
    alt: "Pet Friendly Lakeview — interior",
  },
];

/* ------------------------------------------------------------------ */
/*  Carousel data                                                      */
/* ------------------------------------------------------------------ */

const EXPLORE_POCONOS = [
  {
    title: "Book Your Bachelorette Party",
    image:
      "https://images.unsplash.com/photo-1529543544282-ea6407407db9?w=800&q=80",
    icon: PartyPopper,
    gradient: "from-pink-600/80 to-purple-700/80",
  },
  {
    title: "Gather 'Round the Fire",
    image:
      "https://images.unsplash.com/photo-1475483768296-6163e08872a1?w=800&q=80",
    icon: Flame,
    gradient: "from-orange-600/80 to-red-700/80",
  },
  {
    title: "Plan a Ski Trip",
    image:
      "https://images.unsplash.com/photo-1551524559-8af4e6624178?w=800&q=80",
    icon: Snowflake,
    gradient: "from-sky-600/80 to-blue-800/80",
  },
  {
    title: "Get Out on the Lake",
    image:
      "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&q=80",
    icon: Waves,
    gradient: "from-cyan-600/80 to-teal-700/80",
  },
  {
    title: "Take a Wellness Retreat",
    image:
      "https://images.unsplash.com/photo-1540555700478-4be289fbec6d?w=800&q=80",
    icon: HeartHandshake,
    gradient: "from-emerald-600/80 to-green-800/80",
  },
];

const LOCAL_HIGHLIGHTS = [
  {
    title: "Grab a Bite to Eat",
    image:
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80",
    icon: UtensilsCrossed,
    gradient: "from-amber-600/80 to-orange-700/80",
  },
  {
    title: "Check Out Local Ski Areas",
    image:
      "https://images.unsplash.com/photo-1565992441121-4367c2967103?w=800&q=80",
    icon: Mountain,
    gradient: "from-slate-600/80 to-blue-800/80",
  },
  {
    title: "Get in Touch with Nature",
    image:
      "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80",
    icon: TreePine,
    gradient: "from-green-700/80 to-emerald-900/80",
  },
  {
    title: "Casino Night",
    image:
      "https://images.unsplash.com/photo-1596838132731-3301c3fd4317?w=800&q=80",
    icon: Dices,
    gradient: "from-violet-700/80 to-purple-900/80",
  },
  {
    title: "Go Camping & Glamping",
    image:
      "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&q=80",
    icon: Tent,
    gradient: "from-yellow-700/80 to-amber-900/80",
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

  return (
    <section className="space-y-4">
      <div className="px-4 sm:px-6">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
          {title}
        </h2>
        {subtitle && (
          <p className="text-muted-foreground mt-1">{subtitle}</p>
        )}
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
            return (
              <button
                key={i}
                onClick={() => goTo(i)}
                className="group relative flex-shrink-0 w-[280px] h-[180px] rounded-xl overflow-hidden snap-start focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <img
                  src={item.image}
                  alt={item.title}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div
                  className={`absolute inset-0 bg-gradient-to-t ${item.gradient}`}
                />
                <div className="absolute inset-0 flex flex-col justify-end p-5">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-white/90" />
                    <span className="text-white font-semibold text-base text-left leading-tight">
                      {item.title}
                    </span>
                  </div>
                </div>
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
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b sm:border-b-0 sm:border-r border-white/15 hover:bg-white/5 transition-colors">
          <label htmlFor="v2-checkin" className="block text-xs font-semibold text-white/60 mb-1 tracking-wide text-center sm:text-left">
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
            className="w-full bg-transparent text-white text-base sm:text-lg font-medium outline-none scheme-dark text-center sm:text-left"
            required
          />
        </div>
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b sm:border-b-0 sm:border-r border-white/15 hover:bg-white/5 transition-colors">
          <label htmlFor="v2-checkout" className="block text-xs font-semibold text-white/60 mb-1 tracking-wide text-center sm:text-left">
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
            className="w-full bg-transparent text-white text-base sm:text-lg font-medium outline-none scheme-dark text-center sm:text-left"
            required
          />
        </div>
        <div className="grid grid-cols-2 sm:contents border-b sm:border-b-0 border-white/15">
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-r border-white/15 hover:bg-white/5 transition-colors">
          <label htmlFor="v2-guests" className="block text-xs font-semibold text-white/60 mb-1 tracking-wide text-center sm:text-left">
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
        <div className="px-4 sm:px-6 py-4 sm:py-5 hover:bg-white/5 transition-colors sm:border-r border-white/15">
          <label htmlFor="v2-pets" className="block text-xs font-semibold text-white/60 mb-1 tracking-wide text-center sm:text-left">
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
        </div>
        {/* Desktop: icon button inside the card */}
        <div className="hidden sm:flex items-center justify-center px-3">
          <button
            type="submit"
            className="h-12 w-12 rounded-xl bg-white/15 text-white hover:bg-white/25 transition-colors flex items-center justify-center shrink-0 border border-white/20"
          >
            <Search className="h-5 w-5" />
          </button>
        </div>
      </div>
      {/* Mobile: full-width search button below the card */}
      <button
        type="submit"
        className="sm:hidden w-full h-12 rounded-xl bg-white/15 text-white hover:bg-white/25 transition-colors flex items-center justify-center border border-white/20 gap-2 backdrop-blur-xl"
      >
        <Search className="h-5 w-5" />
        <span className="text-sm font-medium">Search</span>
      </button>
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
    <Link href="/" className="block">
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

function PropertyCard({
  property,
  bookingQuery,
}: {
  property: Property;
  bookingQuery?: { checkIn: string; checkOut: string; guests: number } | null;
}) {
  const nights = bookingQuery
    ? getNightCount(bookingQuery.checkIn, bookingQuery.checkOut)
    : null;

  const bookUrl = bookingQuery
    ? `/book/${property.slug}?check_in=${bookingQuery.checkIn}&check_out=${bookingQuery.checkOut}&guests=${bookingQuery.guests}`
    : `/book/${property.slug}`;

  return (
    <Link href={bookUrl} className="block">
      <Card className="overflow-hidden group hover:shadow-lg transition-shadow">
        <div className="relative h-48 sm:h-56">
          {property.cover_image_url ? (
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
              {property.description}
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
            className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors w-full mt-2 h-8 px-3 ${
              bookingQuery
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "border border-input bg-background hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            <Calendar className="h-4 w-4" />
            {bookingQuery ? "Book Now" : "View Availability"}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Special Offer Card                                                 */
/* ------------------------------------------------------------------ */

function OfferCard({ promotion }: { promotion: Promotion }) {
  const validUntil = promotion.valid_until
    ? new Date(promotion.valid_until + "T00:00:00")
    : null;
  const isExpiringSoon =
    validUntil &&
    validUntil.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;

  return (
    <Card className="overflow-hidden border-amber-200/50 dark:border-amber-800/30 bg-gradient-to-br from-amber-50/50 to-orange-50/30 dark:from-amber-950/20 dark:to-orange-950/10">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <h3 className="font-semibold text-base">{promotion.title}</h3>
            {promotion.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {promotion.description}
              </p>
            )}
          </div>
          <div className="shrink-0">
            {promotion.discount_percent ? (
              <Badge className="bg-amber-600 text-white text-lg font-bold px-3 py-1">
                {promotion.discount_percent}% OFF
              </Badge>
            ) : promotion.discount_amount ? (
              <Badge className="bg-amber-600 text-white text-lg font-bold px-3 py-1">
                ${promotion.discount_amount} OFF
              </Badge>
            ) : (
              <Sparkles className="h-6 w-6 text-amber-600" />
            )}
          </div>
        </div>
        {promotion.promo_code && (
          <div className="flex items-center gap-2">
            <code className="bg-white dark:bg-black/20 border border-dashed border-amber-300 dark:border-amber-700 rounded-lg px-3 py-1.5 text-sm font-mono font-semibold tracking-wider">
              {promotion.promo_code}
            </code>
            {isExpiringSoon && (
              <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                Expires soon!
              </span>
            )}
          </div>
        )}
        {validUntil && (
          <p className="text-xs text-muted-foreground">
            Valid through{" "}
            {validUntil.toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function HomeV2Page() {
  const [heroIndex, setHeroIndex] = useState(0);
  const heroTouchStart = useRef<number | null>(null);
  const [session, setSession] = useState<{
    guestName: string;
    reservation: Reservation;
  } | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Rotate hero images
  useEffect(() => {
    const timer = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % HERO_IMAGES.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

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

    // Fetch public promotions (not property-specific)
    supabase
      .from("promotion")
      .select("id, title, description, promo_code, discount_percent, discount_amount, valid_from, valid_until, is_active")
      .eq("is_active", true)
      .or(`valid_until.is.null,valid_until.gte.${new Date().toISOString().split("T")[0]}`)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setPromotions(data);
      });
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
            <img
              src={img.url}
              alt={img.alt}
              className="w-full h-full object-cover"
            />
          </div>
        ))}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/70" />

        {/* Floating Nav */}
        <SiteNav variant="transparent" />

        {/* Hero content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-6 text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white tracking-tight max-w-3xl leading-tight">
            Your Poconos Getaway Starts Here
          </h1>
          <p className="mt-3 text-lg sm:text-xl text-white/80 max-w-xl">
            Lakefront homes with hot tubs, game rooms, and direct lake access.
            Book direct and save.
          </p>

          {/* Booking search card */}
          <div className="mt-10 w-full max-w-2xl">
            {session ? (
              <TripSummaryCard reservation={session.reservation} />
            ) : (
              <AvailabilitySearch />
            )}
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
      {/*  TRIP SUMMARY (shown below hero when logged in)               */}
      {/* ============================================================ */}
      {session && (
        <section className="px-4 sm:px-6 py-8 max-w-4xl mx-auto w-full">
          <div className="space-y-3">
            <h2 className="text-xl font-semibold">
              Welcome back,{" "}
              {(session.guestName || "").split(" ")[0] || "Guest"}!
            </h2>
            <p className="text-muted-foreground text-sm">
              Your upcoming trip is all set. Tap below to manage your booking,
              complete registration, or browse add-ons.
            </p>
          </div>
        </section>
      )}



      {/* ============================================================ */}
      {/*  OUR HOMES                                                    */}
      {/* ============================================================ */}
      {properties.length > 0 && (
        <section className="px-4 sm:px-6 py-10 max-w-6xl mx-auto w-full">
          <div className="space-y-1 mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Our Homes
            </h2>
            <p className="text-muted-foreground">
              Handpicked lakefront retreats in the Pocono Mountains
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {properties.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        </section>
      )}

      {/* ============================================================ */}
      {/*  UPSCALE EXPERIENCE                                           */}
      {/* ============================================================ */}
      <section className="px-4 sm:px-6 py-16 max-w-6xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
          <div className="space-y-8">
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">
                Upscale experience
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Each lakehouse is thoughtfully designed with premium furnishings,
                elegant d&eacute;cor, and modern amenities to ensure a comfortable and
                sophisticated stay. From serene lakeside views to private outdoor
                spaces, every detail is curated for relaxation and indulgence.
                Personalized services and exclusive features, such as gourmet
                kitchens and hot tubs, elevate the guest experience, making Summit
                Lakeside the ideal retreat for those seeking both tranquility and
                luxury.
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-amber-500">
                Thoughtful convenience
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                From seamless check-ins to fully stocked essentials, every aspect is
                designed to ensure effortless comfort. Modern amenities like
                high-speed Wi-Fi, smart home features, and curated local
                recommendations make it easy for guests to relax and enjoy their
                time without hassle.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-xl font-semibold text-amber-500">
                What you can expect at Summit
              </h3>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-muted-foreground">
                <ul className="space-y-1.5 list-disc list-inside">
                  <li>Stocked Linens &amp; Towels</li>
                  <li>Kitchen utensils</li>
                  <li>Toiletries</li>
                  <li>Blankets</li>
                </ul>
                <ul className="space-y-1.5 list-disc list-inside">
                  <li>USB outlets</li>
                  <li>Newly Renovated</li>
                  <li>Games &amp; Toys</li>
                  <li>Boats &amp; Kayaks</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="relative w-full aspect-4/5 rounded-lg overflow-hidden">
            <img
              src="https://a0.muscache.com/im/pictures/0f3c2d87-7cd0-45bc-bf57-efdcbda6ac7e.jpg?im_w=1200"
              alt="Luxury bathroom with freestanding tub"
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  PET FRIENDLY                                                  */}
      {/* ============================================================ */}
      <section className="px-4 sm:px-6 max-w-6xl mx-auto w-full">
        <div className="relative w-full aspect-16/7 min-h-80 rounded-xl overflow-hidden">
          <img
            src="https://a0.muscache.com/im/pictures/370a991e-fefb-4218-8083-a52775bc931a.jpg?im_w=1200"
            alt="Pet friendly lakefront property"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-linear-to-r from-black/70 via-black/40 to-transparent" />
          <div className="absolute inset-0 flex items-center px-6 sm:px-12 md:px-16">
            <div className="max-w-lg space-y-3">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white leading-tight">
                No need for a dog sitter.
              </h2>
              <p className="text-lg sm:text-xl text-white/90 font-medium">
                Summit Lakeside properties are pet friendly, so you can bring the
                whole family along!
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  GUEST PHOTOS                                                 */}
      {/* ============================================================ */}
      <Separator className="max-w-6xl mx-auto" />
      <GuestPhotoCarousel />

      {/* ============================================================ */}
      {/*  GUEST REVIEWS                                                */}
      {/* ============================================================ */}
      <Separator className="max-w-6xl mx-auto" />
      <ReviewsCarousel />

      <Separator className="max-w-6xl mx-auto" />

      {/* ============================================================ */}
      {/*  EXPLORE POCONOS CAROUSEL                                     */}
      {/* ============================================================ */}
      <div className="py-10 max-w-6xl mx-auto w-full">
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
      <div className="py-10 max-w-6xl mx-auto w-full">
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

      {/* ============================================================ */}
      {/*  SPECIAL OFFERS                                               */}
      {/* ============================================================ */}
      {promotions.length > 0 && (
        <>
          <Separator className="max-w-6xl mx-auto" />
          <section className="px-4 sm:px-6 py-10 max-w-4xl mx-auto w-full">
            <div className="space-y-1 mb-6">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
                <Star className="h-6 w-6 text-amber-500" />
                Special Offers
              </h2>
              <p className="text-muted-foreground">
                Exclusive deals available right now
              </p>
            </div>
            <div className="grid gap-4">
              {promotions.map((promo) => (
                <OfferCard key={promo.id} promotion={promo} />
              ))}
            </div>
          </section>
        </>
      )}

      {/* ============================================================ */}
      {/*  FOOTER                                                       */}
      {/* ============================================================ */}
      <footer className="mt-auto border-t bg-muted/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            <div className="space-y-3">
              <Image
                src="/logo.png"
                alt="Summit Lakeside Rentals"
                width={140}
                height={70}
                className="h-10 w-auto invert dark:invert-0"
              />
              <p className="text-sm text-muted-foreground">
                Premium lakefront vacation homes in the Pocono Mountains of
                Pennsylvania.
              </p>
            </div>
            <div className="space-y-3">
              <h4 className="font-semibold text-sm">Quick Links</h4>
              <nav className="flex flex-col gap-2 text-sm text-muted-foreground">
                <Link href="/checkin" className="hover:text-foreground transition-colors">
                  Find My Booking
                </Link>
                <a
                  href="https://summitlakeside.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                >
                  Visit Our Website
                </a>
              </nav>
            </div>
            <div className="space-y-3">
              <h4 className="font-semibold text-sm">Contact</h4>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>East Stroudsburg, PA</p>
                <p>Pocono Mountains, Pennsylvania</p>
              </div>
            </div>
          </div>
          <Separator className="my-6" />
          <p className="text-xs text-muted-foreground text-center">
            &copy; {new Date().getFullYear()} Summit Lakeside Rentals. All
            rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
