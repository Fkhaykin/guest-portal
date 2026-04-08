"use client";

import { useState, useEffect } from "react";
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
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  MapPin,
  Calendar,
  Users,
  Clock,
  DoorOpen,
  DoorClosed,
  PawPrint,
  Baby,
  User,
  ClipboardCheck,
  ChevronRight,
  Check,
  Flame,
  BedDouble,
  UtensilsCrossed,
  TreePine,
  Coffee,
  Sparkles,
  Lock,
  Heart,
  Truck,
  Car,
  ShoppingBag,
  Package,
} from "lucide-react";
import { GuestHeader, PropertyHeader } from "@/components/guest/guest-header";
import { GuestNav } from "@/components/guest/guest-nav";

type GuestBreakdown = {
  adults: number;
  children: number;
  infants: number;
  pets: number;
};

type LodgifyDetails = {
  check_in_time: string | null;
  check_out_time: string | null;
  total_amount: number | null;
  currency_code: string | null;
  source: string | null;
  guest_breakdown: GuestBreakdown | null;
};

type Reservation = {
  id: string;
  check_in_date: string;
  check_out_date: string;
  num_guests: number;
  notes: string | null;
  status: string;
  signature_url: string | null;
  property: {
    id: string;
    name: string;
    slug: string;
    address: string | null;
    description: string | null;
    cover_image_url: string | null;
    timezone: string;
  };
  lodgify: LodgifyDetails | null;
};

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatShortDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(timeStr: string) {
  const [hours, minutes] = timeStr.split(":");
  const h = parseInt(hours);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${minutes} ${ampm}`;
}

function getNightCount(checkIn: string, checkOut: string) {
  const d1 = new Date(checkIn + "T00:00:00");
  const d2 = new Date(checkOut + "T00:00:00");
  return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

function getDaysUntil(dateStr: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// --- Search Form ---
function BookingSearch({
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
    <main className="flex-1 flex flex-col items-center justify-center p-6">
      <div className="max-w-lg w-full space-y-8">
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-bold tracking-tight">
            Welcome
          </h1>
          <p className="text-muted-foreground text-lg">
            Find your booking to get started
          </p>
        </div>

        <Card>
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
                Enter any combination of name, email, or phone along with your check-in date.
              </p>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Searching..." : "Find My Booking"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

// --- Guest Dashboard ---
const upsellIcons: Record<string, React.ReactNode> = {
  early_checkin: <DoorOpen className="h-5 w-5 text-blue-600" />,
  late_checkout: <DoorClosed className="h-5 w-5 text-blue-600" />,
  new_sheets: <BedDouble className="h-5 w-5 text-purple-600" />,
  firewood: <Flame className="h-5 w-5 text-orange-600" />,
  baby_high_chair: <Baby className="h-5 w-5 text-pink-500" />,
  private_chef: <UtensilsCrossed className="h-5 w-5 text-amber-600" />,
  luxury_picnic: <TreePine className="h-5 w-5 text-green-600" />,
  breakfast_delivery: <Coffee className="h-5 w-5 text-amber-700" />,
  tip_cleaning: <Heart className="h-5 w-5 text-rose-500" />,
  tip_delivery: <Heart className="h-5 w-5 text-rose-500" />,
  tip_breakfast: <Heart className="h-5 w-5 text-rose-500" />,
};

type PurchasedUpsell = {
  type: string;
  label: string;
  price_cents: number;
  status: string;
};

type DeliveryEntry = {
  id: string;
  category: "rideshare" | "food_grocery" | "other";
  provider: string | null;
  num_cars: number;
  arrival_date: string;
  has_return: boolean;
  return_date: string | null;
  created_at: string;
};

function GuestDashboard({
  guestName,
  reservation,
  onReset,
}: {
  guestName: string;
  reservation: Reservation;
  onReset: () => void;
}) {
  const firstName = (guestName || "").split(" ")[0];
  const nights = getNightCount(reservation.check_in_date, reservation.check_out_date);
  const daysUntil = getDaysUntil(reservation.check_in_date);
  const lodgify = reservation.lodgify;
  const breakdown = lodgify?.guest_breakdown;
  const [purchasedUpsells, setPurchasedUpsells] = useState<PurchasedUpsell[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryEntry[]>([]);

  useEffect(() => {
    fetch(`/api/guest/delivery-rideshare?registration_id=${reservation.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.entries) setDeliveries(data.entries);
      })
      .catch(() => {});
  }, [reservation.id]);

  useEffect(() => {
    fetch("/api/guest/upsells", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registration_id: reservation.id }),
    })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.purchased) setPurchasedUpsells(data.purchased);
      })
      .catch(() => {});
  }, [reservation.id]);

  const countdownLabel =
    daysUntil === 0
      ? "Today is the day!"
      : daysUntil === 1
        ? "Tomorrow!"
        : daysUntil > 0
          ? `${daysUntil} days away`
          : "In progress";

  return (
    <main className="flex-1 flex flex-col items-center p-4 sm:p-6">
      <div className="max-w-2xl w-full space-y-6">
        {/* Hero image */}
        {reservation.property.cover_image_url && (
          <div className="relative rounded-xl overflow-hidden aspect-video">
            <img
              src={reservation.property.cover_image_url}
              alt={reservation.property.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
              <h2 className="text-2xl sm:text-3xl font-bold leading-tight">
                {reservation.property.name}
              </h2>
              {reservation.property.address && (
                daysUntil <= 7 ? (
                  <p className="flex items-center gap-1.5 mt-1 text-sm text-white/80">
                    <MapPin className="h-3.5 w-3.5" />
                    {reservation.property.address}
                  </p>
                ) : (
                  <p className="flex items-center gap-1.5 mt-1 text-sm text-white/50">
                    <Lock className="h-3.5 w-3.5" />
                    Address available 7 days before check-in
                  </p>
                )
              )}
            </div>
          </div>
        )}

        {/* Welcome + countdown */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            {firstName ? `Welcome, ${firstName}!` : "Welcome!"}
          </h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Thanks for booking your Poconos getaway with Summit Lakeside
            Rentals! We&apos;re getting everything ready for you &mdash;
            from the hot tub to the lakefront views, your retreat awaits.
            Here&apos;s everything you need to know before you arrive.
          </p>
          {daysUntil >= 0 && (
            <div className="pt-2">
              <Badge variant="secondary" className="text-sm px-4 py-1.5">
                <Clock className="h-3.5 w-3.5 mr-1.5" />
                {countdownLabel}
              </Badge>
            </div>
          )}
        </div>

        {/* Registration banner */}
        {reservation.signature_url ? (
          <div className="rounded-xl border p-5 space-y-3">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-muted p-2 shrink-0 mt-0.5">
                <ClipboardCheck className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-base">
                  Registration complete
                </h3>
                <p className="text-sm text-muted-foreground">
                  Your guest registration has been submitted. Need to make
                  changes? You can update your details anytime before check-in.
                </p>
              </div>
            </div>
            <Link href={`/p/${reservation.property.slug}/update`}>
              <Button variant="outline" size="lg" className="w-full">
                Edit Registration
              </Button>
            </Link>
          </div>
        ) : (
          <div className="rounded-xl border-2 border-primary bg-primary/5 p-5 space-y-3">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary p-2 shrink-0 mt-0.5">
                <ClipboardCheck className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-base">
                  Action required: Complete your guest registration
                </h3>
                <p className="text-sm text-muted-foreground">
                  Before you arrive, we need a few details from you &mdash;
                  guest info, vehicle registration, and any special requests.
                  This helps us prepare for your stay and ensures a smooth check-in.
                </p>
              </div>
            </div>
            <Link href={`/p/${reservation.property.slug}/register`}>
              <Button size="lg" className="w-full">
                Complete Guest Registration
              </Button>
            </Link>
          </div>
        )}

        {/* Booking details grid */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Your Reservation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Check-in / Check-out row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border p-4 space-y-1">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <DoorOpen className="h-3.5 w-3.5" />
                  Check-in
                </div>
                <p className="font-semibold">
                  {formatShortDate(reservation.check_in_date)}
                </p>
                {lodgify?.check_in_time && (
                  <p className="text-sm text-muted-foreground">
                    After {formatTime(lodgify.check_in_time)}
                  </p>
                )}
              </div>
              <div className="rounded-lg border p-4 space-y-1">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <DoorClosed className="h-3.5 w-3.5" />
                  Check-out
                </div>
                <p className="font-semibold">
                  {formatShortDate(reservation.check_out_date)}
                </p>
                {lodgify?.check_out_time && (
                  <p className="text-sm text-muted-foreground">
                    By {formatTime(lodgify.check_out_time)}
                  </p>
                )}
              </div>
            </div>

            {/* Stay duration */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Duration</span>
              <span className="font-medium">
                {nights} night{nights !== 1 ? "s" : ""}
              </span>
            </div>

            <Separator />

            {/* Guest breakdown */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Guests</p>
              <div className="flex flex-wrap gap-3">
                {breakdown ? (
                  <>
                    {breakdown.adults > 0 && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <User className="h-4 w-4" />
                        {breakdown.adults} adult{breakdown.adults !== 1 ? "s" : ""}
                      </div>
                    )}
                    {breakdown.children > 0 && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        {breakdown.children} child{breakdown.children !== 1 ? "ren" : ""}
                      </div>
                    )}
                    {breakdown.infants > 0 && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Baby className="h-4 w-4" />
                        {breakdown.infants} infant{breakdown.infants !== 1 ? "s" : ""}
                      </div>
                    )}
                    {breakdown.pets > 0 && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <PawPrint className="h-4 w-4" />
                        {breakdown.pets} pet{breakdown.pets !== 1 ? "s" : ""}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    {reservation.num_guests} guest{reservation.num_guests !== 1 ? "s" : ""}
                  </div>
                )}
              </div>
            </div>

            {/* Dates full display */}
            <Separator />
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  Arrival
                </span>
                <span>{formatDate(reservation.check_in_date)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  Departure
                </span>
                <span>{formatDate(reservation.check_out_date)}</span>
              </div>
            </div>

            {reservation.notes && (
              <>
                <Separator />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Notes</p>
                  <p className="text-sm text-muted-foreground">
                    {reservation.notes}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Location */}
        {reservation.property.address && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="h-5 w-5" /> Location
              </CardTitle>
            </CardHeader>
            <CardContent>
              {daysUntil <= 7 ? (
                <div className="space-y-3">
                  <p className="text-sm font-medium">{reservation.property.address}</p>
                  <div className="rounded-lg overflow-hidden border">
                    <iframe
                      width="100%"
                      height="250"
                      style={{ border: 0 }}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      src={`https://maps.google.com/maps?q=${encodeURIComponent(reservation.property.address)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                    />
                  </div>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(reservation.property.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" size="sm" className="w-full">
                      <MapPin className="h-4 w-4 mr-1.5" /> Get Directions
                    </Button>
                  </a>
                </div>
              ) : (
                <div className="rounded-lg bg-muted/50 p-6 text-center space-y-2">
                  <Lock className="h-8 w-8 text-muted-foreground mx-auto" />
                  <p className="text-sm font-medium text-muted-foreground">
                    Exact address &amp; map available 7 days before check-in
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {daysUntil > 7
                      ? `You'll receive it on ${formatDate(
                          new Date(
                            new Date(reservation.check_in_date + "T00:00:00").getTime() - 7 * 24 * 60 * 60 * 1000
                          ).toISOString().split("T")[0]
                        )}`
                      : ""}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Purchased add-ons */}
        {purchasedUpsells.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5" /> Your Add-Ons
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {purchasedUpsells.map((u, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="shrink-0">
                    {upsellIcons[u.type] || <Sparkles className="h-5 w-5 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{u.label}</p>
                    {u.price_cents > 0 && (
                      <p className="text-xs text-muted-foreground">${(u.price_cents / 100).toFixed(2)}</p>
                    )}
                  </div>
                  <Check className="h-4 w-4 text-green-600 shrink-0" />
                </div>
              ))}
              <Link href={`/p/${reservation.property.slug}/add-ons`}>
                <Button variant="outline" size="sm" className="w-full mt-2">
                  Browse More Add-Ons
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Deliveries & Rideshares */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Truck className="h-5 w-5" /> Deliveries & Rideshares
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {deliveries.length > 0 ? (
              deliveries.map((d) => (
                <div key={d.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="shrink-0">
                    {d.category === "rideshare" ? (
                      <Car className="h-5 w-5 text-blue-600" />
                    ) : d.category === "food_grocery" ? (
                      <ShoppingBag className="h-5 w-5 text-green-600" />
                    ) : (
                      <Package className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {d.provider || "Other"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatShortDate(d.arrival_date)}
                      {d.category === "rideshare" && d.num_cars > 1 && ` \u00b7 ${d.num_cars} cars`}
                      {d.has_return && d.return_date && ` \u00b7 Return ${formatShortDate(d.return_date)}`}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-xs shrink-0">
                    {d.category === "rideshare" ? "Ride" : d.category === "food_grocery" ? "Delivery" : "Other"}
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-2">
                No deliveries or rideshares registered yet.
              </p>
            )}
            <Link href={`/p/${reservation.property.slug}/delivery`}>
              <Button variant="outline" size="sm" className="w-full mt-2">
                Register Delivery / Rideshare
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Explore property links */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Explore Your Property</CardTitle>
            <CardDescription>
              Everything you need to know about your stay
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {[
              { label: "Property Home", href: `/p/${reservation.property.slug}`, icon: "home" },
              { label: "Services", href: `/p/${reservation.property.slug}/services`, icon: "services" },
              { label: "FAQ", href: `/p/${reservation.property.slug}/faq`, icon: "faq" },
              { label: "Recommendations", href: `/p/${reservation.property.slug}/recommendations`, icon: "recs" },
              { label: "Videos", href: `/p/${reservation.property.slug}/videos`, icon: "videos" },
              { label: "Promotions", href: `/p/${reservation.property.slug}/promotions`, icon: "promos" },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center gap-2 rounded-lg border p-3 text-sm font-medium hover:bg-accent transition-colors"
              >
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                {item.label}
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* Footer actions */}
        <div className="pb-8">
          <Button
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={onReset}
          >
            Log Out
          </Button>
        </div>
      </div>
    </main>
  );
}

// --- Refresh reservation from DB ---
async function refreshReservation(stale: Reservation): Promise<Reservation | null> {
  try {
    const res = await fetch("/api/guest/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registration_id: stale.id }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { ...stale, signature_url: data.signature_url };
  } catch {
    return null;
  }
}

// --- Session persistence ---
const SESSION_KEY = "guest-portal-session";

function saveSession(guestName: string, reservation: Reservation) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ guestName, reservation }));
  } catch {
    // Storage full or unavailable
  }
}

function loadSession(): { guestName: string; reservation: Reservation } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignore
  }
}

// --- Root ---
export default function HomePage() {
  const [guestName, setGuestName] = useState("");
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Handle auth callback code that lands on root (Supabase magic link)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      window.location.href = `/auth/callback?code=${code}&redirect=/admin`;
      return;
    }

    // Admin preview: auto-login as guest from ?reg=REGISTRATION_ID
    const regId = params.get("reg");
    if (regId) {
      // Clean the URL so a refresh doesn't re-fetch
      window.history.replaceState({}, "", "/");
      fetch(`/api/guest/preview?reg=${encodeURIComponent(regId)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data) {
            setGuestName(data.guest_name);
            setReservation(data.reservation);
            saveSession(data.guest_name, data.reservation);
          }
          setLoaded(true);
        })
        .catch(() => setLoaded(true));
      return;
    }

    const session = loadSession();
    if (session) {
      setGuestName(session.guestName);
      setReservation(session.reservation);

      // Re-fetch to pick up changes made during registration
      refreshReservation(session.reservation).then((fresh) => {
        if (fresh) {
          setReservation(fresh);
          saveSession(session.guestName, fresh);
        }
      });
    }
    setLoaded(true);
  }, []);

  if (!loaded) return null;

  return (
    <>
      {reservation ? (
        <>
          <PropertyHeader propertyName={reservation.property.name} />
          <GuestNav slug={reservation.property.slug} />
          <GuestDashboard
            guestName={guestName}
            reservation={reservation}
            onReset={() => {
              setReservation(null);
              setGuestName("");
              clearSession();
            }}
          />
        </>
      ) : (
        <>
          <GuestHeader />
          <BookingSearch
            onFound={({ guestName: name, reservation: res }) => {
              setGuestName(name);
              setReservation(res);
              saveSession(name, res);
            }}
          />
        </>
      )}
    </>
  );
}
