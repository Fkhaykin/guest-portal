"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChevronLeft,
  ChevronRight,
  Users,
  MapPin,
  Mountain,
  Waves,
  UtensilsCrossed,
  TreePine,
  Bike,
  ShoppingBag,
  Sparkles,
  Heart,
  Mail,
  Menu,
  X,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const HERO_IMAGES = [
  "https://l.icdbcdn.com/oh/50c22370-10d6-4d03-a5de-32850450a9cc.jpg?w=2080",
  "https://l.icdbcdn.com/oh/a76e1fe4-7e5a-4132-930b-9590e921f4b6.jpg?w=2080",
  "https://l.icdbcdn.com/oh/311087b3-8e1e-4f24-a0a9-369f403bae88.jpg?w=2080",
  "https://l.icdbcdn.com/oh/dbdc55c3-eefe-4dc5-a935-f87a24f8bd15.jpg?w=2080",
  "https://l.icdbcdn.com/oh/d6286b3e-1cc0-4a50-ac1e-0a1391fbd148.jpg?w=2080",
  "https://l.icdbcdn.com/oh/00f0a1c3-98a8-4809-a307-bf9fed4b0f32.jpg?w=2080",
  "https://l.icdbcdn.com/oh/70c85f21-ddb7-48b6-a074-d6531fcc2a5a.jpg?w=2080",
  "https://l.icdbcdn.com/oh/378c067c-9ea7-479f-b0fa-ec12927f112e.jpg?w=2080",
];

const PROPERTIES = [
  {
    name: "Lakefront Home w/ Hot Tub, Game Room, Deck, Boats, Fire Pit",
    guests: 12,
    image:
      "https://l.icdbcdn.com/oh/50c22370-10d6-4d03-a5de-32850450a9cc.jpg?w=800",
  },
  {
    name: "Lakeview Chalet w/ Hot Tub, Sauna, Decks, Boats, & Fire Pit",
    guests: 12,
    image:
      "https://l.icdbcdn.com/oh/a76e1fe4-7e5a-4132-930b-9590e921f4b6.jpg?w=800",
  },
  {
    name: "Lake Adjacent Home w/ Hot Tub, Game Room, Boats, Fenced Yard",
    guests: 12,
    image:
      "https://l.icdbcdn.com/oh/311087b3-8e1e-4f24-a0a9-369f403bae88.jpg?w=800",
  },
  {
    name: "Poconos Lakefront with Hot Tub, Boats, and More",
    guests: 12,
    image:
      "https://l.icdbcdn.com/oh/dbdc55c3-eefe-4dc5-a935-f87a24f8bd15.jpg?w=800",
  },
  {
    name: "Cozy Lakefront Home w/ Game Room, Hot Tub, Fire Pit, & Boats",
    guests: 8,
    image:
      "https://l.icdbcdn.com/oh/d6286b3e-1cc0-4a50-ac1e-0a1391fbd148.jpg?w=800",
  },
  {
    name: "Lakefront Mansion w/ 3 Decks, Hot Tub, Boats, & Game Room",
    guests: 12,
    image:
      "https://l.icdbcdn.com/oh/00f0a1c3-98a8-4809-a307-bf9fed4b0f32.jpg?w=800",
  },
  {
    name: "Luxury Lakefront Chalet in Poconos 1.5hrs from NYC",
    guests: 12,
    image:
      "https://l.icdbcdn.com/oh/70c85f21-ddb7-48b6-a074-d6531fcc2a5a.jpg?w=800",
  },
];

const ACTIVITIES = [
  {
    title: "Skiing, Snowboarding & Tubing",
    description:
      "Hit the slopes at Camelback Mountain, Jack Frost Big Boulder, and Shawnee Mountain — options for all skill levels.",
    icon: Mountain,
    image:
      "https://sites.psu.edu/aedpassion/files/2018/10/camelback-skiing-1erq9e4.jpg",
  },
  {
    title: "Hiking, Camping & Fishing",
    description:
      "Explore trails at Delaware Water Gap and Hickory Run State Park. Fish on Lake Wallenpaupack and the Lehigh River.",
    icon: TreePine,
    image:
      "https://www.shawneeinn.com/wp-content/uploads/2021/03/abbyventure-Instagram-3106-ig-17843343686495882.jpg",
  },
  {
    title: "Lakes, Rivers & Waterfalls",
    description:
      "Discover stunning waterfalls like Bushkill Falls and Dingmans Falls, plus kayaking, boating, and swimming.",
    icon: Waves,
    image:
      "https://www.shawneeinn.com/wp-content/uploads/2015/05/Bushkill-Falls-Blog-750x500-1.jpg",
  },
  {
    title: "Dining & Restaurants",
    description:
      "Savor local favorites like The Farmhouse, PizzaOne, and Garlîc — from casual American to fine dining.",
    icon: UtensilsCrossed,
    image:
      "https://assets.simpleviewinc.com/simpleview/image/upload/crm/poconos/pmvb-patio-sunset_F9D8A47F-D25A-47EB-91C7105468C2C0EF_9efe8556-58a3-4770-975191932e588cbf.jpg",
  },
  {
    title: "Adventure Sports",
    description:
      "ATV tours, ziplining, rock climbing, and cliff jumping — the Poconos has it all for thrill seekers.",
    icon: Bike,
    image:
      "https://res.cloudinary.com/simpleview/image/upload/v1520893042/clients/poconos/enduro_2245494_1920_0e5ed0ac-5567-414e-bfb9-14997416a336.jpg",
  },
  {
    title: "Shopping & Local Attractions",
    description:
      "Browse Downtown Stroudsburg boutiques, Grandpa Joe's Candy Shop, and The Crossings Premium Outlets.",
    icon: ShoppingBag,
    image:
      "https://imagescdn.homes.com/i2/9MaZ416sUY95vX7oSEsn--xEKPiWibKRDKiiOGMU87o/114/downtown-stroudsburg-stroudsburg-pa-2.jpg",
  },
  {
    title: "Spa & Wellness",
    description:
      "Unwind at The Lodge at Woodloch or Spa at Mount Airy with massages, facials, and wellness retreats.",
    icon: Sparkles,
    image:
      "https://images.squarespace-cdn.com/content/v1/628c0b15a05f901ab56011a3/fb10c08f-ca83-4b25-b50e-1f2d71503900/Poconos+Spa.jpg",
  },
];

const NAV_LINKS = [
  { label: "Properties", href: "#properties" },
  { label: "Things To Do", href: "#activities" },
  { label: "About", href: "#about" },
  { label: "Contact", href: "#contact" },
];

/* ------------------------------------------------------------------ */
/*  Hero Carousel                                                      */
/* ------------------------------------------------------------------ */

function HeroCarousel() {
  const [current, setCurrent] = useState(0);

  const next = useCallback(
    () => setCurrent((c) => (c + 1) % HERO_IMAGES.length),
    []
  );
  const prev = useCallback(
    () => setCurrent((c) => (c - 1 + HERO_IMAGES.length) % HERO_IMAGES.length),
    []
  );

  useEffect(() => {
    const timer = setInterval(next, 6000);
    return () => clearInterval(timer);
  }, [next]);

  return (
    <div className="relative w-full h-[70vh] min-h-125 max-h-200 overflow-hidden">
      {HERO_IMAGES.map((src, i) => (
        <div
          key={i}
          className="absolute inset-0 transition-opacity duration-1000"
          style={{ opacity: i === current ? 1 : 0 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={`Summit Lakeside property ${i + 1}`}
            className="w-full h-full object-cover"
          />
        </div>
      ))}

      {/* Overlay */}
      <div className="absolute inset-0 bg-linear-to-b from-black/50 via-black/20 to-black/60" />

      {/* Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white px-6">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-4 drop-shadow-lg">
          Summit Lakeside Rentals
        </h1>
        <p className="text-lg sm:text-xl md:text-2xl text-white/90 max-w-2xl mb-8 drop-shadow">
          Your Poconos vacation starts here.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <a href="#properties">
            <Button
              size="lg"
              className="bg-white text-black hover:bg-white/90 text-base px-8"
            >
              View Properties
            </Button>
          </a>
          <a href="#booking">
            <Button
              size="lg"
              variant="outline"
              className="border-white text-white hover:bg-white/10 text-base px-8"
            >
              Find My Booking
            </Button>
          </a>
        </div>
      </div>

      {/* Arrows */}
      <button
        onClick={prev}
        className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors"
        aria-label="Previous image"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
      <button
        onClick={next}
        className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors"
        aria-label="Next image"
      >
        <ChevronRight className="h-6 w-6" />
      </button>

      {/* Dots */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
        {HERO_IMAGES.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`w-2.5 h-2.5 rounded-full transition-colors ${
              i === current ? "bg-white" : "bg-white/40"
            }`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Site Header                                                        */
/* ------------------------------------------------------------------ */

function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-background/95 backdrop-blur border-b shadow-sm"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <Link href="/" className="hover:opacity-80 transition-opacity">
          <Image
            src="/logo.png"
            alt="Summit Lakeside"
            width={140}
            height={70}
            className={`h-9 w-auto transition-all ${
              scrolled ? "invert dark:invert-0" : "brightness-0 invert"
            }`}
            priority
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className={`text-sm font-medium transition-colors hover:opacity-80 ${
                scrolled ? "text-foreground" : "text-white"
              }`}
            >
              {link.label}
            </a>
          ))}
          <a href="#booking">
            <Button
              size="sm"
              className={
                scrolled
                  ? ""
                  : "bg-white text-black hover:bg-white/90"
              }
            >
              Book Now
            </Button>
          </a>
        </nav>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? (
            <X
              className={`h-6 w-6 ${
                scrolled ? "text-foreground" : "text-white"
              }`}
            />
          ) : (
            <Menu
              className={`h-6 w-6 ${
                scrolled ? "text-foreground" : "text-white"
              }`}
            />
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-background border-b shadow-lg">
          <nav className="flex flex-col px-6 py-4 gap-4">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm font-medium text-foreground"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <a href="#booking" onClick={() => setMobileOpen(false)}>
              <Button size="sm" className="w-full">
                Book Now
              </Button>
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}

/* ------------------------------------------------------------------ */
/*  Booking Search (embedded)                                          */
/* ------------------------------------------------------------------ */

type Reservation = {
  id: string;
  check_in_date: string;
  check_out_date: string;
  num_guests: number;
  notes: string | null;
  status: string;
  signature_url: string | null;
  booking_source: string | null;
  property: {
    id: string;
    name: string;
    slug: string;
    address: string | null;
    description: string | null;
    cover_image_url: string | null;
    timezone: string;
  };
  lodgify: {
    check_in_time: string | null;
    check_out_time: string | null;
    total_amount: number | null;
    currency_code: string | null;
    source: string | null;
    guest_breakdown: {
      adults: number;
      children: number;
      infants: number;
      pets: number;
    } | null;
  } | null;
};

function BookingSearchSection({
  onFound,
}: {
  onFound: (data: { guestName: string; reservation: Reservation }) => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [checkInDate, setCheckInDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasIdentifier = fullName.trim() || email.trim() || phone.trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasIdentifier) {
      setError("Please enter at least your name, email, or phone number.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const body: Record<string, string> = { check_in_date: checkInDate };
      if (fullName.trim()) body.full_name = fullName.trim();
      if (email.trim()) body.email = email.trim();
      if (phone.trim()) body.phone = phone.trim();

      const res = await fetch("/api/guest/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
      } else {
        onFound({ guestName: data.guest_name, reservation: data.reservation });
      }
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="booking" className="py-20 px-4 sm:px-6 bg-muted/50">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            Already Booked?
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Look up your reservation to access your guest portal, complete
            registration, and explore everything your property has to offer.
          </p>
        </div>

        <Card className="max-w-lg mx-auto">
          <CardHeader>
            <CardTitle>Find Your Booking</CardTitle>
            <CardDescription>
              Enter your details to pull up your reservation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full-name">Name</Label>
                <Input
                  id="full-name"
                  type="text"
                  placeholder="John Smith"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+1 (555) 000-0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="check-in">Check-in Date</Label>
                <Input
                  id="check-in"
                  type="date"
                  value={checkInDate}
                  onChange={(e) => setCheckInDate(e.target.value)}
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Enter any combination of name, email, or phone along with your
                check-in date.
              </p>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Searching..." : "Find My Booking"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Book Direct Section                                                */
/* ------------------------------------------------------------------ */

function BookDirectSection() {
  return (
    <section className="py-16 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
          Book Direct & Save
        </h2>
        <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
          Book directly with us for the best rates, or use your preferred
          third-party booking site.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a href="#booking">
            <Button size="lg" className="text-base px-8">
              Book Direct ($)
            </Button>
          </a>
          <a
            href="https://www.airbnb.com/users/show/103542564"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="lg" className="text-base px-8">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://cdn-icons-png.flaticon.com/512/2111/2111320.png"
                alt="Airbnb"
                className="h-5 w-5 mr-2"
              />
              Airbnb ($$)
            </Button>
          </a>
          <a
            href="https://www.vrbo.com/2534807"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="lg" className="text-base px-8">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://seeklogo.com/images/V/vrbo-logo-D6A4B14690-seeklogo.com.png"
                alt="VRBO"
                className="h-5 w-5 mr-2"
              />
              VRBO ($$$)
            </Button>
          </a>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Landing Page                                                  */
/* ------------------------------------------------------------------ */

export function LandingPage({
  onFound,
}: {
  onFound: (data: { guestName: string; reservation: Reservation }) => void;
}) {
  return (
    <div className="min-h-screen">
      <SiteHeader />

      {/* Hero */}
      <HeroCarousel />

      {/* About */}
      <section id="about" className="py-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-6">
            Welcome to Summit Lakeside Rentals
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed max-w-3xl mx-auto">
            Our Poconos rental homes offer the ideal retreat for your friends
            and family. Relaxation and tranquility await at the perfect escape
            for those who want to feel like they are a world away, but may not
            want to drive for hours to get there. Our lakefront homes feel cozy
            and secluded with large, private, wooded properties and direct lake
            access.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-12">
            {[
              { value: "7", label: "Properties" },
              { value: "12", label: "Max Guests" },
              { value: "Lakefront", label: "Location" },
              { value: "1.5 hrs", label: "From NYC" },
            ].map((stat) => (
              <div key={stat.label} className="space-y-1">
                <p className="text-2xl sm:text-3xl font-bold">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Properties */}
      <section id="properties" className="py-20 px-4 sm:px-6 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
              Our Properties
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Lakefront homes in the Poconos with hot tubs, game rooms, boats,
              and everything you need for the perfect getaway.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {PROPERTIES.map((property, i) => (
              <Card key={i} className="overflow-hidden group cursor-pointer">
                <div className="aspect-4/3 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={property.image}
                    alt={property.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <CardContent className="p-5">
                  <h3 className="font-semibold text-base leading-snug mb-2">
                    {property.name}
                  </h3>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      Up to {property.guests} guests
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      Poconos, PA
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Book Direct */}
      <BookDirectSection />

      {/* Things To Do */}
      <section id="activities" className="py-20 px-4 sm:px-6 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
              Things To Do in the Poconos
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              From skiing to spa days, the Poconos has something for everyone.
              Here are some of our favorite local activities.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {ACTIVITIES.map((activity, i) => {
              const Icon = activity.icon;
              return (
                <Card key={i} className="overflow-hidden group">
                  <div className="aspect-16/10 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={activity.image}
                      alt={activity.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold text-base">
                        {activity.title}
                      </h3>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {activity.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Booking Search */}
      <BookingSearchSection onFound={onFound} />

      {/* Contact */}
      <section id="contact" className="py-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            Get In Touch
          </h2>
          <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
            Questions, comments, and requests welcome. We&apos;d love to help
            you plan your Poconos getaway.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <a
              href="mailto:info@summitlakeside.com"
              className="flex items-center gap-2 text-base hover:opacity-70 transition-opacity"
            >
              <Mail className="h-5 w-5" />
              info@summitlakeside.com
            </a>
            <a
              href="https://www.instagram.com/summitlakeside"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-base hover:opacity-70 transition-opacity"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
              @summitlakeside
            </a>
            <span className="flex items-center gap-2 text-base text-muted-foreground">
              <MapPin className="h-5 w-5" />
              East Stroudsburg, PA
            </span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/30 py-10 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Summit Lakeside"
              width={100}
              height={50}
              className="h-7 w-auto invert dark:invert-0"
            />
            <span className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} Summit Lakeside Rentals
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#properties" className="hover:text-foreground transition-colors">
              Properties
            </a>
            <a href="#activities" className="hover:text-foreground transition-colors">
              Things To Do
            </a>
            <a href="#contact" className="hover:text-foreground transition-colors">
              Contact
            </a>
            <a href="#booking" className="hover:text-foreground transition-colors">
              Find Booking
            </a>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-6 pt-6 border-t text-center">
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
            Made with <Heart className="h-3 w-3 text-rose-500" /> in the
            Poconos
          </p>
        </div>
      </footer>
    </div>
  );
}
