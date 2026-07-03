"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import {
  Ban,
  Bath,
  BedDouble,
  Car,
  Check,
  ChevronDown,
  Clock,
  ExternalLink,
  Flame,
  Gamepad2,
  MapPin,
  PawPrint,
  Ruler,
  Sailboat,
  Shirt,
  Snowflake,
  Star,
  Tv,
  Users,
  UtensilsCrossed,
  WashingMachine,
  Waves,
  Wifi,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ReviewsCarousel } from "@/components/guest/reviews-carousel";
import { REVIEWS } from "@/lib/reviews-data";
import type { PropertyDetails } from "@/lib/property-details";
import { PropertyGallery } from "./gallery";
import { AvailabilityCalendar, BookingCard, MobileBookingBar, useBooking } from "./booking";

/* ------------------------------------------------------------------ */
/*  House aliases — some houses have an old + new property row; merge  */
/*  their review history                                               */
/* ------------------------------------------------------------------ */

const HOUSE_NAME_ALIASES: Record<string, string[]> = {
  "Lakeview Chalet w/ hot tub, sauna, fire pit & decks": [
    "Lakeview Chalet w/ Hot Tub, Sauna, Decks, Boats, & Fire Pit!",
  ],
  "Poconos Lakefront with Hot Tub, boats, and more!": [
    "Lakefront Home w/ Hot Tub, Game Room, Deck, Boats, Fire Pit",
  ],
};

/* ------------------------------------------------------------------ */
/*  Amenity icons                                                      */
/* ------------------------------------------------------------------ */

const AMENITY_LABELS: Record<string, string> = {
  cooking: "Kitchen & Dining",
  entertainment: "Entertainment",
  heating: "Heating & Cooling",
  laundry: "Laundry",
  miscellaneous: "Home Safety",
  sanitary: "Bathroom & Spa",
  sleeping: "Sleeping",
  parking: "Parking",
  room: "Rooms",
  "further-info": "Additional Info",
  outside: "Outdoor",
  livingroom: "Living Room",
};

/** Icon for a single amenity line, matched by keyword. */
function amenityIcon(text: string) {
  const t = text.toLowerCase();
  if (t.includes("hot tub") || t.includes("jacuzzi")) return Bath;
  if (t.includes("sauna")) return Flame;
  if (t.includes("wifi") || t.includes("internet")) return Wifi;
  if (t.includes("tv") || t.includes("television")) return Tv;
  if (t.includes("game") || t.includes("billiard") || t.includes("ping pong")) return Gamepad2;
  if (t.includes("fire")) return Flame;
  if (t.includes("washer") || t.includes("laundry") || t.includes("washing")) return WashingMachine;
  if (t.includes("dryer") || t.includes("iron")) return Shirt;
  if (t.includes("air condition") || t.includes("a/c")) return Snowflake;
  if (t.includes("boat") || t.includes("kayak") || t.includes("canoe") || t.includes("paddle")) return Sailboat;
  if (t.includes("lake") || t.includes("beach") || t.includes("water")) return Waves;
  if (t.includes("parking") || t.includes("garage") || t.includes("car")) return Car;
  if (t.includes("kitchen") || t.includes("oven") || t.includes("stove") || t.includes("grill") || t.includes("bbq") || t.includes("dish")) return UtensilsCrossed;
  if (t.includes("pet") || t.includes("dog")) return PawPrint;
  if (t.includes("bed") || t.includes("linen") || t.includes("crib")) return BedDouble;
  if (t.includes("bath") || t.includes("shower") || t.includes("towel")) return Bath;
  return Check;
}

/* ------------------------------------------------------------------ */
/*  Highlights — the headline features of the house                    */
/* ------------------------------------------------------------------ */

type Highlight = { label: string; icon: React.ComponentType<{ className?: string }> };

function deriveHighlights(details: PropertyDetails): Highlight[] {
  const { property, lodgify } = details;
  const amenityText = lodgify
    ? Object.values(lodgify.amenities).flat().map((a) => a.text).join(" · ")
    : "";
  const haystack = `${property.name} · ${amenityText}`.toLowerCase();

  const defs: { match: RegExp; label: string; icon: Highlight["icon"] }[] = [
    { match: /hot tub|jacuzzi/, label: "Hot tub", icon: Bath },
    { match: /sauna/, label: "Sauna", icon: Flame },
    { match: /game|billiard|ping pong|arcade/, label: "Game room", icon: Gamepad2 },
    { match: /fire ?pit/, label: "Fire pit", icon: Flame },
    { match: /lake/, label: "Lake access", icon: Waves },
    { match: /boat|kayak|canoe|paddle/, label: "Boats & kayaks", icon: Sailboat },
    { match: /deck|patio|balcon/, label: "Decks & patio", icon: Ruler },
  ];

  const highlights: Highlight[] = [];
  for (const def of defs) {
    if (def.match.test(haystack)) highlights.push({ label: def.label, icon: def.icon });
  }
  if (lodgify?.pets_allowed) highlights.push({ label: "Pet friendly", icon: PawPrint });
  if (lodgify?.has_wifi) highlights.push({ label: "WiFi", icon: Wifi });
  if (lodgify?.has_parking) highlights.push({ label: "Free parking", icon: Car });
  return highlights.slice(0, 6);
}

/* ------------------------------------------------------------------ */
/*  Reveal-on-scroll wrapper                                           */
/* ------------------------------------------------------------------ */

function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Reduced-motion users see content immediately, without the slide-up.
  return (
    <div
      ref={ref}
      className={`${className} transition-all duration-700 ease-out motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-y-0 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
      }`}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section nav — sticky scrollspy bar                                 */
/* ------------------------------------------------------------------ */

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "amenities", label: "Amenities" },
  { id: "availability", label: "Availability" },
  { id: "reviews", label: "Reviews" },
  { id: "location", label: "Location" },
  { id: "policies", label: "Policies" },
];

function useScrollSpy(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      // A slim band around the upper third of the viewport decides the
      // active section, so it flips as a section header crosses it.
      { rootMargin: "-30% 0px -60% 0px" }
    );
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    }
    return () => obs.disconnect();
  }, [ids]);
  return active;
}

function SectionNav() {
  const active = useScrollSpy(useMemo(() => SECTIONS.map((s) => s.id), []));

  return (
    <div className="sticky top-16 z-30 bg-background/85 backdrop-blur-xl border-b mt-6">
      <nav
        className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1 overflow-x-auto"
        style={{ scrollbarWidth: "none" }}
        aria-label="Page sections"
      >
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            onClick={(e) => {
              e.preventDefault();
              document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className={`shrink-0 px-3 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              active === s.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {s.label}
          </a>
        ))}
      </nav>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Location map                                                       */
/* ------------------------------------------------------------------ */

const MAP_OPTIONS: google.maps.MapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  gestureHandling: "cooperative",
  styles: [
    { featureType: "poi", stylers: [{ visibility: "off" }] },
    { featureType: "transit", stylers: [{ visibility: "off" }] },
  ],
};

function LocationMap({ lat, lng }: { lat: number; lng: number }) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
  });

  if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) return null;

  if (!isLoaded) {
    return <div className="w-full h-96 rounded-2xl bg-muted animate-pulse" />;
  }

  return (
    <GoogleMap
      mapContainerStyle={{ width: "100%", height: "24rem", borderRadius: "1rem" }}
      center={{ lat, lng }}
      zoom={13}
      options={MAP_OPTIONS}
    >
      <Marker
        position={{ lat, lng }}
        icon={{
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="52" viewBox="0 0 44 52">
              <path d="M22 0C10 0 0 10 0 22c0 16 22 30 22 30s22-14 22-30C44 10 34 0 22 0z" fill="#2d6a8f"/>
              <circle cx="22" cy="20" r="11" fill="white"/>
              <text x="22" y="26" text-anchor="middle" font-size="16" fill="#2d6a8f">&#8962;</text>
            </svg>`
          )}`,
          scaledSize: new google.maps.Size(44, 52),
          anchor: new google.maps.Point(22, 52),
        }}
      />
    </GoogleMap>
  );
}

const NEARBY = [
  { label: "Camelback Mountain", detail: "Skiing & Aquatopia waterpark" },
  { label: "Bushkill Falls", detail: "The “Niagara of Pennsylvania”" },
  { label: "Shawnee Mountain", detail: "Family-friendly ski area" },
  { label: "Crossings Premium Outlets", detail: "100+ outlet stores" },
  { label: "Delaware Water Gap", detail: "Hiking & scenic drives" },
];

/* ------------------------------------------------------------------ */
/*  Property Page                                                      */
/* ------------------------------------------------------------------ */

export function PropertyPage({
  details,
  checkIn,
  checkOut,
  guests,
  pets,
}: {
  details: PropertyDetails;
  checkIn?: string;
  checkOut?: string;
  guests?: string;
  pets?: string;
}) {
  const { property, lodgify } = details;
  const [descExpanded, setDescExpanded] = useState(false);

  const images = useMemo(() => {
    if (lodgify?.images.length) return lodgify.images;
    return property.cover_image_url ? [{ url: property.cover_image_url }] : [];
  }, [lodgify, property.cover_image_url]);

  const maxGuests = property.max_guests ?? 12;
  const booking = useBooking({
    lodgifyPropertyId: property.lodgify_property_id,
    propertySlug: property.slug,
    maxGuests,
    petsAllowed: lodgify?.pets_allowed ?? true,
    initialCheckIn: checkIn,
    initialCheckOut: checkOut,
    initialGuests: guests,
    initialPets: pets,
  });

  const reviewNames = useMemo(
    () => [property.name, ...(HOUSE_NAME_ALIASES[property.name] ?? [])],
    [property.name]
  );
  const { reviewCount, reviewAvg } = useMemo(() => {
    const list = REVIEWS.filter((r) => reviewNames.includes(r.property));
    return {
      reviewCount: list.length,
      reviewAvg: list.length
        ? list.reduce((sum, r) => sum + r.rating, 0) / list.length
        : null,
    };
  }, [reviewNames]);

  const highlights = useMemo(() => deriveHighlights(details), [details]);

  const amenityCategories = lodgify
    ? Object.entries(lodgify.amenities).filter(([, items]) => items.length > 0)
    : [];
  const allAmenities = amenityCategories.flatMap(([, items]) => items);
  const topAmenities = allAmenities.slice(0, 10);

  const longDescription = (property.description?.length ?? 0) > 500;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteNav />

      <div className="pt-16 pb-24 lg:pb-0">
        <PropertyGallery images={images} propertyName={property.name} />

        <SectionNav />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8">
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-12 xl:gap-16 lg:items-start">
            {/* ---------------- Main column ---------------- */}
            <main className="space-y-10 min-w-0">
              {/* Overview */}
              <section id="overview" className="scroll-mt-32 space-y-5">
                <div className="space-y-2">
                  <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-balance">
                    {property.name}
                  </h1>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    {lodgify?.city && (
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        {lodgify.city}, {lodgify.state} — the Poconos
                      </span>
                    )}
                    {reviewAvg !== null && (
                      <a
                        href="#reviews"
                        onClick={(e) => {
                          e.preventDefault();
                          document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth" });
                        }}
                        className="flex items-center gap-1.5 font-medium hover:underline underline-offset-4"
                      >
                        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                        {reviewAvg.toFixed(2)}
                        <span className="text-muted-foreground font-normal">
                          · {reviewCount} reviews
                        </span>
                      </a>
                    )}
                  </div>
                </div>

                {/* Quick stats */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    {maxGuests} guests
                  </span>
                  {lodgify && lodgify.bedrooms > 0 && (
                    <span className="flex items-center gap-1.5 font-medium">
                      <BedDouble className="h-4 w-4 text-muted-foreground" />
                      {lodgify.bedrooms} bedrooms
                    </span>
                  )}
                  {lodgify && lodgify.bathrooms > 0 && (
                    <span className="flex items-center gap-1.5 font-medium">
                      <Bath className="h-4 w-4 text-muted-foreground" />
                      {lodgify.bathrooms} bathrooms
                    </span>
                  )}
                  {lodgify?.area && (
                    <span className="flex items-center gap-1.5 font-medium">
                      <Ruler className="h-4 w-4 text-muted-foreground" />
                      {lodgify.area.toLocaleString()} {lodgify.area_unit}
                    </span>
                  )}
                </div>

                {/* Highlights */}
                {highlights.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                    {highlights.map((h) => (
                      <div
                        key={h.label}
                        className="flex items-center gap-3 rounded-xl border bg-card p-3.5"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <h.icon className="h-4.5 w-4.5" />
                        </span>
                        <span className="text-sm font-medium leading-tight">{h.label}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Description */}
                {property.description && (
                  <div className="pt-1">
                    <div
                      className={`relative overflow-hidden transition-[max-height] duration-500 ${
                        descExpanded || !longDescription ? "max-h-1600" : "max-h-72"
                      }`}
                    >
                      <div
                        className="text-muted-foreground leading-relaxed prose prose-sm max-w-none dark:prose-invert"
                        dangerouslySetInnerHTML={{
                          __html: property.description.replace(/<\/?p>/g, (m) =>
                            m === "<p>" ? '<p class="mb-3">' : "</p>"
                          ),
                        }}
                      />
                      {!descExpanded && longDescription && (
                        <div className="absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-background to-transparent" />
                      )}
                    </div>
                    {longDescription && (
                      <button
                        onClick={() => setDescExpanded((v) => !v)}
                        className="mt-2 flex items-center gap-1 text-sm font-semibold underline underline-offset-4 hover:text-muted-foreground"
                      >
                        {descExpanded ? "Show less" : "Read more"}
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${descExpanded ? "rotate-180" : ""}`}
                        />
                      </button>
                    )}
                  </div>
                )}
              </section>

              {/* Amenities */}
              {amenityCategories.length > 0 && (
                <>
                  <Separator />
                  <Reveal>
                    <section id="amenities" className="scroll-mt-32 space-y-4">
                      <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                        What this place offers
                      </h2>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                        {topAmenities.map((item, i) => {
                          const Icon = amenityIcon(item.text);
                          return (
                            <div key={i} className="flex items-center gap-3 text-sm">
                              <Icon className="h-4.5 w-4.5 text-muted-foreground shrink-0" />
                              {item.text}
                            </div>
                          );
                        })}
                      </div>
                      {allAmenities.length > topAmenities.length && (
                        <Dialog>
                          <DialogTrigger
                            render={<Button variant="outline" className="mt-1" />}
                          >
                            Show all {allAmenities.length} amenities
                          </DialogTrigger>
                          <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
                            <DialogHeader>
                              <DialogTitle>What this place offers</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-6">
                              {amenityCategories.map(([category, items]) => (
                                <div key={category} className="space-y-2.5">
                                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                                    {AMENITY_LABELS[category] || category}
                                  </h3>
                                  <ul className="space-y-2.5">
                                    {items.map((item, i) => {
                                      const Icon = amenityIcon(item.text);
                                      return (
                                        <li key={i} className="flex items-center gap-3 text-sm">
                                          <Icon className="h-4.5 w-4.5 text-muted-foreground shrink-0" />
                                          {item.text}
                                        </li>
                                      );
                                    })}
                                  </ul>
                                </div>
                              ))}
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                    </section>
                  </Reveal>
                </>
              )}

              <Separator />

              {/* Availability */}
              <section id="availability" className="scroll-mt-32 space-y-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                    Choose your dates
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Live availability — checkout day frees up for same-day turnover.
                  </p>
                </div>
                <AvailabilityCalendar booking={booking} />

                {/* On mobile the booking card lives under the calendar */}
                <div className="lg:hidden pt-2">
                  <BookingCard booking={booking} minPrice={lodgify?.min_price ?? null} />
                </div>
              </section>
            </main>

            {/* ---------------- Sticky booking rail ---------------- */}
            <aside className="hidden lg:block">
              <div className="sticky top-24">
                <BookingCard booking={booking} minPrice={lodgify?.min_price ?? null} />
              </div>
            </aside>
          </div>
        </div>

        {/* Reviews */}
        <section id="reviews" className="scroll-mt-24">
          <ReviewsCarousel
            ctaHref="#availability"
            ctaLabel="Check availability"
            propertyNames={reviewNames}
          />
        </section>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12 space-y-10">
          <Separator />

          {/* Location */}
          <Reveal>
            <section id="location" className="scroll-mt-32 space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                    Where you&apos;ll be
                  </h2>
                  {lodgify?.city && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {lodgify.city}, {lodgify.state} — about 1.5 hours from NYC
                    </p>
                  )}
                </div>
                {lodgify && (
                  <a
                    href={`https://www.google.com/maps?q=${lodgify.lat},${lodgify.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline underline-offset-4"
                  >
                    Open in Google Maps <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>

              {lodgify && <LocationMap lat={lodgify.lat} lng={lodgify.lng} />}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {NEARBY.map((place) => (
                  <div key={place.label} className="flex items-start gap-3 rounded-xl border bg-card p-3.5">
                    <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{place.label}</p>
                      <p className="text-xs text-muted-foreground">{place.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </Reveal>

          <Separator />

          {/* Policies */}
          <Reveal>
            <section id="policies" className="scroll-mt-32 space-y-4">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Good to know</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-xl border bg-card p-4 space-y-1">
                  <Clock className="h-4.5 w-4.5 text-primary" />
                  <p className="text-sm font-semibold pt-1">Check-in</p>
                  <p className="text-sm text-muted-foreground">After 4:00 PM</p>
                </div>
                <div className="rounded-xl border bg-card p-4 space-y-1">
                  <Clock className="h-4.5 w-4.5 text-primary" />
                  <p className="text-sm font-semibold pt-1">Check-out</p>
                  <p className="text-sm text-muted-foreground">Before 11:00 AM</p>
                </div>
                <div className="rounded-xl border bg-card p-4 space-y-1">
                  <PawPrint className="h-4.5 w-4.5 text-primary" />
                  <p className="text-sm font-semibold pt-1">Pets</p>
                  <p className="text-sm text-muted-foreground">
                    {(lodgify?.pets_allowed ?? true) ? "Dogs welcome" : "Not allowed"}
                  </p>
                </div>
                <div className="rounded-xl border bg-card p-4 space-y-1">
                  <Ban className="h-4.5 w-4.5 text-primary" />
                  <p className="text-sm font-semibold pt-1">Smoking</p>
                  <p className="text-sm text-muted-foreground">Not allowed</p>
                </div>
              </div>
              <a
                href="/rental-policies"
                className="inline-block text-sm font-medium text-primary hover:underline underline-offset-4"
              >
                Read the full rental policies →
              </a>
            </section>
          </Reveal>
        </div>
      </div>

      <MobileBookingBar booking={booking} minPrice={lodgify?.min_price ?? null} />

      <SiteFooter />
    </div>
  );
}
