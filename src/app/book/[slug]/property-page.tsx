"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import {
  Ban,
  Bath,
  BedDouble,
  Car,
  ChevronDown,
  Clock,
  Flame,
  Gamepad2,
  MapPin,
  PawPrint,
  Ruler,
  Sailboat,
  Star,
  Users,
  Waves,
  Wifi,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { ReviewsCarousel } from "@/components/guest/reviews-carousel";
import { REVIEWS } from "@/lib/reviews-data";
import type { PropertyDetails } from "@/lib/property-details";
import {
  EditorialCollage,
  GalleryWall,
  planPhotoSections,
  PropertyGallery,
  RoomShowcase,
  ScenicBreak,
  Triptych,
} from "./gallery";
import { AvailabilityCalendar, BookingCard, MobileBookingBar, useBooking } from "./booking";
import { AmenitiesSection } from "./amenities";
import { LocalPlacesSection } from "./local-places";

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
  if (lodgify?.has_wifi) highlights.push({ label: "Fast WiFi", icon: Wifi });
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
  { id: "gallery", label: "Gallery" },
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

function SectionNav({ hasGallery }: { hasGallery: boolean }) {
  const sections = useMemo(
    () => SECTIONS.filter((s) => hasGallery || s.id !== "gallery"),
    [hasGallery]
  );
  const active = useScrollSpy(useMemo(() => sections.map((s) => s.id), [sections]));

  return (
    <div className="sticky top-16 z-30 bg-background/85 backdrop-blur-xl border-b mt-6">
      <nav
        className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1 overflow-x-auto"
        style={{ scrollbarWidth: "none" }}
        aria-label="Page sections"
      >
        {sections.map((s) => (
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
    petFeeCents: property.pet_fee_cents,
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
  const photoPlan = useMemo(() => planPhotoSections(images), [images]);

  const longDescription = (property.description?.length ?? 0) > 500;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteNav />

      <div className="pt-16 pb-24 lg:pb-0">
        <PropertyGallery
          images={images}
          propertyName={property.name}
          mosaicPicks={photoPlan.mosaic}
        />

        <SectionNav hasGallery={photoPlan.wall.length >= 6} />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8">
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-12 xl:gap-16">
            {/* ---------------- Main column ---------------- */}
            <main className="space-y-12 min-w-0">
              {/* Overview */}
              <section id="overview" className="scroll-mt-32 space-y-5">
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                    Summit Lakeside · Pocono Mountains
                  </p>
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
                        className="flex items-center gap-3 rounded-2xl border bg-card p-3.5"
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

                {/* Interior collage — a first look inside */}
                {photoPlan.collageA.length === 3 && (
                  <div className="pt-2">
                    <EditorialCollage
                      images={images}
                      picks={photoPlan.collageA}
                      propertyName={property.name}
                    />
                  </div>
                )}
              </section>

              {/* Amenities — sanitized + ranked (Lodgify's raw feed is unusable) */}
              {lodgify && (
                <>
                  <Separator />
                  <Reveal>
                    <AmenitiesSection
                      amenities={lodgify.amenities}
                      propertyName={property.name}
                    />
                  </Reveal>
                </>
              )}

              {/* Room-by-room photo strip */}
              {images.length >= 8 && (
                <>
                  <Separator />
                  <Reveal>
                    <RoomShowcase images={images} propertyName={property.name} />
                  </Reveal>
                </>
              )}

              <Separator />

              {/* Availability */}
              <section id="availability" className="scroll-mt-32 space-y-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary mb-2">
                    Your stay
                  </p>
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

              {/* Outdoor collage — hot tub, fire pit, decks */}
              {photoPlan.collageB.length === 3 && (
                <Reveal>
                  <EditorialCollage
                    images={images}
                    picks={photoPlan.collageB}
                    propertyName={property.name}
                    flip
                  />
                </Reveal>
              )}
            </main>

            {/* ---------------- Sticky booking rail ---------------- */}
            {/* top-32 clears the fixed site nav + sticky section bar with a
                comfortable gap once the rail pins */}
            <aside className="hidden lg:block">
              <div className="sticky top-32">
                <BookingCard booking={booking} minPrice={lodgify?.min_price ?? null} />
              </div>
            </aside>
          </div>
        </div>

        {/* Masonry gallery wall */}
        {photoPlan.wall.length >= 6 && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-12">
            <Reveal>
              <GalleryWall
                images={images}
                picks={photoPlan.wall}
                propertyName={property.name}
              />
            </Reveal>
          </div>
        )}

        {/* Reviews */}
        <section id="reviews" className="scroll-mt-24">
          <ReviewsCarousel
            ctaHref="#availability"
            ctaLabel="Check availability"
            propertyNames={reviewNames}
          />
        </section>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12 space-y-12">
          {/* Scenic interlude — a breath of the outdoors between sections */}
          <Reveal>
            <ScenicBreak images={images} pick={photoPlan.scenic} propertyName={property.name} />
          </Reveal>

          {/* Location — interactive area explorer */}
          {lodgify && (
            <Reveal>
              <LocalPlacesSection
                lat={lodgify.lat}
                lng={lodgify.lng}
                city={lodgify.city}
                state={lodgify.state}
              />
            </Reveal>
          )}

          <Separator />

          {/* Policies */}
          <Reveal>
            <section id="policies" className="scroll-mt-32 space-y-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary mb-2">
                  House notes
                </p>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Good to know</h2>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-2xl border bg-card p-4 space-y-1">
                  <Clock className="h-4.5 w-4.5 text-primary" />
                  <p className="text-sm font-semibold pt-1">Check-in</p>
                  <p className="text-sm text-muted-foreground">After 4:00 PM</p>
                </div>
                <div className="rounded-2xl border bg-card p-4 space-y-1">
                  <Clock className="h-4.5 w-4.5 text-primary" />
                  <p className="text-sm font-semibold pt-1">Check-out</p>
                  <p className="text-sm text-muted-foreground">Before 11:00 AM</p>
                </div>
                <div className="rounded-2xl border bg-card p-4 space-y-1">
                  <PawPrint className="h-4.5 w-4.5 text-primary" />
                  <p className="text-sm font-semibold pt-1">Pets</p>
                  <p className="text-sm text-muted-foreground">
                    {(lodgify?.pets_allowed ?? true) ? "Dogs welcome" : "Not allowed"}
                  </p>
                </div>
                <div className="rounded-2xl border bg-card p-4 space-y-1">
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

          {/* Closing band — the Poconos beyond the front door */}
          {photoPlan.closing.length === 3 && (
            <Reveal>
              <section className="space-y-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary mb-2">
                    Out &amp; about
                  </p>
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                    Beyond the front door
                  </h2>
                </div>
                <Triptych images={images} picks={photoPlan.closing} />
              </section>
            </Reveal>
          )}
        </div>
      </div>

      <MobileBookingBar booking={booking} minPrice={lodgify?.min_price ?? null} />

      <SiteFooter />
    </div>
  );
}
