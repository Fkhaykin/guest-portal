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
import {
  Search,
  MapPin,
  Calendar,
  Users,
  ChevronRight,
  ChevronDown,
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
  Menu,
  X,
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
    url: "https://l.icdbcdn.com/oh/50c22370-10d6-4d03-a5de-32850450a9cc.jpg?w=2080",
    alt: "Summit Lakeside lakefront home",
  },
  {
    url: "https://l.icdbcdn.com/oh/a76e1fe4-7e5a-4132-930b-9590e921f4b6.jpg?w=2080",
    alt: "Lakeside deck with mountain views",
  },
  {
    url: "https://l.icdbcdn.com/oh/311087b3-8e1e-4f24-a0a9-369f403bae88.jpg?w=2080",
    alt: "Cozy cabin interior",
  },
  {
    url: "https://l.icdbcdn.com/oh/dbdc55c3-eefe-4dc5-a935-f87a24f8bd15.jpg?w=2080",
    alt: "Hot tub with lake views",
  },
  {
    url: "https://l.icdbcdn.com/oh/d6286b3e-1cc0-4a50-ac1e-0a1391fbd148.jpg?w=2080",
    alt: "Pocono Mountains lakefront property",
  },
  {
    url: "https://l.icdbcdn.com/oh/00f0a1c3-98a8-4809-a307-bf9fed4b0f32.jpg?w=2080",
    alt: "Firepit by the lake at sunset",
  },
  {
    url: "https://l.icdbcdn.com/oh/70c85f21-ddb7-48b6-a074-d6531fcc2a5a.jpg?w=2080",
    alt: "Mountain retreat exterior",
  },
  {
    url: "https://l.icdbcdn.com/oh/378c067c-9ea7-479f-b0fa-ec12927f112e.jpg?w=2080",
    alt: "Lakeside living room with panoramic views",
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

const NAV_LINKS = [
  { label: "Home", href: "/home-v2" },
  { label: "Visit Poconos", href: "#explore" },
  { label: "Why Summit?", href: "#why-summit" },
  { label: "Contact Us", href: "#contact" },
];

const RESOURCES_LINKS = [
  { label: "Rental Policies", href: "#" },
  { label: "Management Service", href: "#" },
  { label: "Rental Agreement", href: "#" },
];

function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const resourcesTimeout = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 40);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-black/70 backdrop-blur-xl border-b border-white/10 shadow-lg"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/home-v2" className="shrink-0">
            <Image
              src="/logo.png"
              alt="Summit Lakeside Rentals"
              width={140}
              height={70}
              className="h-9 w-auto"
              priority
            />
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="px-3 py-2 text-sm font-medium text-white/80 hover:text-white transition-colors rounded-lg hover:bg-white/10"
              >
                {link.label}
              </Link>
            ))}

            {/* Resources dropdown */}
            <div
              className="relative"
              onMouseEnter={() => {
                if (resourcesTimeout.current) clearTimeout(resourcesTimeout.current);
                setResourcesOpen(true);
              }}
              onMouseLeave={() => {
                resourcesTimeout.current = setTimeout(() => setResourcesOpen(false), 150);
              }}
            >
              <button
                className="px-3 py-2 text-sm font-medium text-white/80 hover:text-white transition-colors rounded-lg hover:bg-white/10 flex items-center gap-1"
                onClick={() => setResourcesOpen(!resourcesOpen)}
              >
                Resources
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${resourcesOpen ? "rotate-180" : ""}`} />
              </button>
              {resourcesOpen && (
                <div className="absolute top-full left-0 mt-1 w-52 rounded-xl bg-black/80 backdrop-blur-xl border border-white/15 shadow-xl overflow-hidden py-1">
                  {RESOURCES_LINKS.map((link) => (
                    <Link
                      key={link.label}
                      href={link.href}
                      className="block px-4 py-2.5 text-sm text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                      onClick={() => setResourcesOpen(false)}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* CTA */}
            <Link
              href="#book"
              className="ml-3 px-5 py-2 text-sm font-semibold bg-white text-black rounded-lg hover:bg-white/90 transition-colors"
              onClick={(e) => {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              Book Now
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 text-white/80 hover:text-white transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-black/90 backdrop-blur-xl border-t border-white/10">
          <div className="px-4 py-4 space-y-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="block px-4 py-3 text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="px-4 py-2 text-xs font-semibold text-white/40 uppercase tracking-wide">
              Resources
            </div>
            {RESOURCES_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="block px-4 py-3 pl-8 text-sm text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-2 px-4">
              <Link
                href="#book"
                className="block w-full text-center px-5 py-3 text-sm font-semibold bg-white text-black rounded-lg hover:bg-white/90 transition-colors"
                onClick={(e) => {
                  e.preventDefault();
                  setMobileOpen(false);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                Book Now
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/*  Availability Search Form (navigates to /search)                    */
/* ------------------------------------------------------------------ */

function AvailabilitySearch() {
  const today = new Date().toISOString().split("T")[0];
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState(2);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!checkIn || !checkOut) return;
    const params = new URLSearchParams({
      check_in: checkIn,
      check_out: checkOut,
      guests: String(guests),
    });
    window.location.href = `/search?${params}`;
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex items-stretch rounded-2xl overflow-hidden bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl shadow-black/20">
        <div className="flex-1 px-6 py-5 border-r border-white/15 hover:bg-white/5 transition-colors">
          <label htmlFor="v2-checkin" className="block text-xs font-semibold text-white/60 mb-1 tracking-wide">
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
            className="w-full bg-transparent text-white text-lg font-medium outline-none scheme-dark"
            required
          />
        </div>
        <div className="flex-1 px-6 py-5 border-r border-white/15 hover:bg-white/5 transition-colors">
          <label htmlFor="v2-checkout" className="block text-xs font-semibold text-white/60 mb-1 tracking-wide">
            Check-out
          </label>
          <input
            id="v2-checkout"
            type="date"
            min={checkIn || today}
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
            className="w-full bg-transparent text-white text-lg font-medium outline-none scheme-dark"
            required
          />
        </div>
        <div className="w-28 px-6 py-5 border-r border-white/15 hover:bg-white/5 transition-colors">
          <label htmlFor="v2-guests" className="block text-xs font-semibold text-white/60 mb-1 tracking-wide">
            Guests
          </label>
          <input
            id="v2-guests"
            type="number"
            min={1}
            max={30}
            value={guests}
            onChange={(e) => setGuests(parseInt(e.target.value) || 1)}
            className="w-full bg-transparent text-white text-lg font-medium outline-none scheme-dark"
          />
        </div>
        <div className="flex items-center px-3">
          <button
            type="submit"
            className="h-12 w-12 rounded-xl bg-white/15 text-white hover:bg-white/25 transition-colors flex items-center justify-center shrink-0 border border-white/20"
          >
            <Search className="h-5 w-5" />
          </button>
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
          {property.address && (
            <p className="text-sm text-muted-foreground flex items-start gap-1.5">
              <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span className="line-clamp-1">{property.address}</span>
            </p>
          )}
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
      .order("name")
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
    <div className="min-h-screen flex flex-col">
      {/* ============================================================ */}
      {/*  HERO + BOOKING SEARCH                                       */}
      {/* ============================================================ */}
      <section className="relative min-h-screen flex flex-col">
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
        <SiteNav />

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
              href="/"
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
                <Link href="/" className="hover:text-foreground transition-colors">
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
