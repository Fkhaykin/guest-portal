"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Users,
  BedDouble,
  Bath,
  Ruler,
  PawPrint,
  Car,
  Wifi,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Star,
  MapPin,
  DollarSign,
  Flame,
  Snowflake,
  Tv,
  UtensilsCrossed,
  ShieldCheck,
  Droplets,
  Shirt,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { BookingCalendar } from "./booking-widget";

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
  lodgify_property_id: number;
};

type LodgifyDetails = {
  min_price: number | null;
  max_price: number | null;
  currency: string;
  rating: number;
  lat: number;
  lng: number;
  city: string | null;
  state: string | null;
  bedrooms: number;
  bathrooms: number;
  area: number | null;
  area_unit: string | null;
  pets_allowed: boolean;
  has_parking: boolean;
  has_wifi: boolean;
  images: { url: string }[];
  amenities: Record<string, { name: string; text: string; prefix: string | null }[]>;
};

/* ------------------------------------------------------------------ */
/*  Amenity category icons                                             */
/* ------------------------------------------------------------------ */

const AMENITY_ICONS: Record<string, React.ReactNode> = {
  cooking: <UtensilsCrossed className="h-4 w-4" />,
  entertainment: <Tv className="h-4 w-4" />,
  heating: <Flame className="h-4 w-4" />,
  laundry: <Shirt className="h-4 w-4" />,
  miscellaneous: <ShieldCheck className="h-4 w-4" />,
  sanitary: <Droplets className="h-4 w-4" />,
  sleeping: <BedDouble className="h-4 w-4" />,
  parking: <Car className="h-4 w-4" />,
  room: <BedDouble className="h-4 w-4" />,
};

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

/* ------------------------------------------------------------------ */
/*  Photo Gallery                                                      */
/* ------------------------------------------------------------------ */

function PhotoGallery({ images }: { images: { url: string }[] }) {
  const [current, setCurrent] = useState(0);
  const [showAll, setShowAll] = useState(false);

  if (images.length === 0) return null;

  return (
    <>
      {/* Main gallery */}
      <div className="relative group">
        <div className="aspect-[16/9] sm:aspect-[2/1] overflow-hidden rounded-xl">
          <img
            src={images[current].url}
            alt={`Photo ${current + 1}`}
            className="w-full h-full object-cover"
          />
        </div>
        {images.length > 1 && (
          <>
            <button
              onClick={() => setCurrent((p) => (p - 1 + images.length) % images.length)}
              className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => setCurrent((p) => (p + 1) % images.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
              {images.slice(0, 10).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === current ? "w-5 bg-white" : "w-1.5 bg-white/50"
                  }`}
                />
              ))}
              {images.length > 10 && (
                <span className="text-white/70 text-xs ml-1">
                  +{images.length - 10}
                </span>
              )}
            </div>
            <button
              onClick={() => setShowAll(true)}
              className="absolute bottom-3 right-3 px-3 py-1.5 rounded-lg bg-black/60 text-white text-xs font-medium hover:bg-black/80 transition-colors backdrop-blur-sm"
            >
              View all {images.length} photos
            </button>
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto py-2 scrollbar-hide" style={{ scrollbarWidth: "none" }}>
          {images.slice(0, 8).map((img, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`shrink-0 w-20 h-14 rounded-lg overflow-hidden border-2 transition-colors ${
                i === current ? "border-primary" : "border-transparent opacity-70 hover:opacity-100"
              }`}
            >
              <img src={img.url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
          {images.length > 8 && (
            <button
              onClick={() => setShowAll(true)}
              className="shrink-0 w-20 h-14 rounded-lg bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground"
            >
              +{images.length - 8}
            </button>
          )}
        </div>
      )}

      {/* Full gallery modal */}
      {showAll && (
        <div className="fixed inset-0 z-50 bg-black/95 overflow-y-auto p-4 sm:p-8">
          <div className="max-w-5xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-white text-lg font-semibold">
                All Photos ({images.length})
              </h2>
              <button
                onClick={() => setShowAll(false)}
                className="text-white/70 hover:text-white text-sm"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {images.map((img, i) => (
                <img
                  key={i}
                  src={img.url}
                  alt={`Photo ${i + 1}`}
                  className="w-full rounded-lg"
                  loading="lazy"
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Property Page                                                      */
/* ------------------------------------------------------------------ */

export function PropertyPage({
  property,
  checkIn,
  checkOut,
  guests,
}: {
  property: Property;
  checkIn?: string;
  checkOut?: string;
  guests?: string;
}) {
  const [lodgify, setLodgify] = useState<LodgifyDetails | null>(null);
  const [maxGuests, setMaxGuests] = useState(property.max_guests);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`/api/property-details?slug=${property.slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.lodgify) setLodgify(data.lodgify);
        if (data?.property?.max_guests) setMaxGuests(data.property.max_guests);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [property.slug]);

  const images = lodgify?.images || [];
  if (property.cover_image_url && !images.some((img) => img.url === property.cover_image_url)) {
    images.unshift({ url: property.cover_image_url });
  }

  const amenityCategories = lodgify
    ? Object.entries(lodgify.amenities).filter(([, items]) => items.length > 0)
    : [];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="max-w-6xl mx-auto flex items-center gap-4 px-4 sm:px-6 h-14">
          <Link
            href="/home-v2"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <div className="flex-1 flex justify-center">
            <Image
              src="/logo.png"
              alt="Summit Lakeside Rentals"
              width={120}
              height={60}
              className="h-8 w-auto invert dark:invert-0"
            />
          </div>
          <a
            href={`https://checkout.lodgify.com/en/summitlakeside/${property.lodgify_property_id}/reservation`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </header>

      <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-6 space-y-8">
        {/* Photo gallery */}
        {images.length > 0 && <PhotoGallery images={images} />}

        {/* Title + quick facts */}
        <div className="space-y-3">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {property.name}
          </h1>

          {lodgify?.city && (
            <p className="text-muted-foreground flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              {lodgify.city}, {lodgify.state}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 text-sm">
            {(lodgify?.bedrooms || maxGuests) && (
              <>
                {maxGuests && (
                  <span className="flex items-center gap-1.5 font-medium">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    {maxGuests} Guests
                  </span>
                )}
                {lodgify && lodgify.bedrooms > 0 && (
                  <span className="flex items-center gap-1.5 font-medium">
                    <BedDouble className="h-4 w-4 text-muted-foreground" />
                    {lodgify.bedrooms} Bedrooms
                  </span>
                )}
                {lodgify && lodgify.bathrooms > 0 && (
                  <span className="flex items-center gap-1.5 font-medium">
                    <Bath className="h-4 w-4 text-muted-foreground" />
                    {lodgify.bathrooms} Bathrooms
                  </span>
                )}
                {lodgify?.area && (
                  <span className="flex items-center gap-1.5 font-medium">
                    <Ruler className="h-4 w-4 text-muted-foreground" />
                    {lodgify.area.toLocaleString()} {lodgify.area_unit}
                  </span>
                )}
              </>
            )}
          </div>

          {/* Highlight badges */}
          <div className="flex flex-wrap gap-2">
            {lodgify?.has_parking && (
              <Badge variant="secondary" className="gap-1.5">
                <Car className="h-3 w-3" /> Parking
              </Badge>
            )}
            {lodgify?.pets_allowed && (
              <Badge variant="secondary" className="gap-1.5">
                <PawPrint className="h-3 w-3" /> Pets Welcome
              </Badge>
            )}
            {lodgify?.has_wifi && (
              <Badge variant="secondary" className="gap-1.5">
                <Wifi className="h-3 w-3" /> WiFi
              </Badge>
            )}
          </div>

          {/* Price range */}
          {lodgify?.min_price && (
            <p className="text-lg font-semibold">
              From ${Math.round(lodgify.min_price)}
              <span className="text-sm font-normal text-muted-foreground">
                {" "}/ night
              </span>
            </p>
          )}
        </div>

        <Separator />

        {/* Description */}
        {property.description && (
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">About This Property</h2>
            <div
              className="text-muted-foreground leading-relaxed prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{
                __html: property.description.replace(/<\/?p>/g, (m) =>
                  m === "<p>" ? '<p class="mb-3">' : "</p>"
                ),
              }}
            />
          </div>
        )}

        {/* Amenities */}
        {amenityCategories.length > 0 && (
          <>
            <Separator />
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Amenities</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {amenityCategories.map(([category, items]) => (
                  <div key={category} className="space-y-2">
                    <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                      {AMENITY_ICONS[category] || null}
                      {AMENITY_LABELS[category] || category}
                    </h3>
                    <ul className="space-y-1">
                      {items.map((item, i) => (
                        <li key={i} className="text-sm text-muted-foreground pl-6">
                          {item.text}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* House rules */}
        <Separator />
        <div className="space-y-3">
          <h2 className="text-xl font-semibold">House Rules</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div className="space-y-1">
              <p className="font-medium">Check-in</p>
              <p className="text-muted-foreground">After 4:00 PM</p>
            </div>
            <div className="space-y-1">
              <p className="font-medium">Check-out</p>
              <p className="text-muted-foreground">Before 11:00 AM</p>
            </div>
            <div className="space-y-1">
              <p className="font-medium">Pets</p>
              <p className="text-muted-foreground">
                {lodgify?.pets_allowed ? "Allowed" : "Not allowed"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="font-medium">Smoking</p>
              <p className="text-muted-foreground">Not allowed</p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Booking calendar */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Availability & Booking</h2>
          <BookingCalendar
            lodgifyPropertyId={property.lodgify_property_id}
            checkIn={checkIn}
            checkOut={checkOut}
            guests={guests}
          />
        </div>

        {/* Spacer */}
        <div className="h-8" />
      </div>

      {/* Footer */}
      <footer className="mt-auto border-t py-6 text-center text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} Summit Lakeside Rentals. All rights
        reserved.
      </footer>
    </div>
  );
}
