"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  MapPin,
  Calendar,
  Users,
  Mountain,
  Loader2,
  Map as MapIcon,
  List,
} from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { useSearchParams, useRouter } from "next/navigation";
import {
  GoogleMap,
  useJsApiLoader,
  MarkerF,
  InfoWindowF,
} from "@react-google-maps/api";
import { createClient } from "@/lib/supabase/client";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type AvailableProperty = {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  description: string | null;
  cover_image_url: string | null;
  max_guests: number | null;
};

type PropertyWithCoords = AvailableProperty & {
  lat: number;
  lng: number;
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

function fmtPrice(cents: number) {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

function getNightCount(checkIn: string, checkOut: string) {
  const d1 = new Date(checkIn + "T00:00:00");
  const d2 = new Date(checkOut + "T00:00:00");
  return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

/* ------------------------------------------------------------------ */
/*  Results Map                                                        */
/* ------------------------------------------------------------------ */

const MAP_STYLES = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

// Pocono Mountains center
const DEFAULT_CENTER = { lat: 41.035, lng: -75.23 };

function ResultsMap({
  properties,
  hoveredId,
  onHover,
  checkIn,
  checkOut,
  guests,
  pricingMap,
}: {
  properties: PropertyWithCoords[];
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  checkIn: string;
  checkOut: string;
  guests: number;
  pricingMap: Record<string, { total_cents: number; room_rate_cents: number; min_stay_nights: number } | null>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = properties.find((p) => p.id === selectedId);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
  });

  const onLoad = useCallback(
    (map: google.maps.Map) => {
      if (properties.length === 0) return;
      const bounds = new google.maps.LatLngBounds();
      properties.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
      map.fitBounds(bounds, 60);
    },
    [properties]
  );

  if (!isLoaded) {
    return (
      <div className="w-full h-full bg-muted flex items-center justify-center rounded-xl">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerClassName="w-full h-full rounded-xl"
      center={DEFAULT_CENTER}
      zoom={13}
      onLoad={onLoad}
      options={{
        disableDefaultUI: true,
        zoomControl: true,
        styles: MAP_STYLES,
        gestureHandling: "cooperative",
      }}
    >
      {properties.map((p) => (
        <MarkerF
          key={p.id}
          position={{ lat: p.lat, lng: p.lng }}
          onClick={() => setSelectedId(p.id)}
          onMouseOver={() => onHover(p.id)}
          onMouseOut={() => onHover(null)}
          icon={
            hoveredId === p.id || selectedId === p.id
              ? {
                  url: `data:image/svg+xml,${encodeURIComponent(
                    '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="%23000" stroke="white" stroke-width="3"/><text x="18" y="23" text-anchor="middle" fill="white" font-size="14" font-weight="bold" font-family="sans-serif">&#x2302;</text></svg>'
                  )}`,
                  scaledSize: new google.maps.Size(36, 36),
                  anchor: new google.maps.Point(18, 18),
                }
              : {
                  url: `data:image/svg+xml,${encodeURIComponent(
                    '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><circle cx="14" cy="14" r="12" fill="white" stroke="%23333" stroke-width="2"/><text x="14" y="19" text-anchor="middle" fill="%23333" font-size="12" font-weight="bold" font-family="sans-serif">&#x2302;</text></svg>'
                  )}`,
                  scaledSize: new google.maps.Size(28, 28),
                  anchor: new google.maps.Point(14, 14),
                }
          }
        />
      ))}
      {selected && (
        <InfoWindowF
          position={{ lat: selected.lat, lng: selected.lng }}
          onCloseClick={() => setSelectedId(null)}
        >
          <Link
            href={checkIn && checkOut ? `/book/${selected.slug}?check_in=${checkIn}&check_out=${checkOut}&guests=${guests}` : `/book/${selected.slug}`}
            className="block max-w-[220px] no-underline text-inherit"
          >
            {selected.cover_image_url && (
              <img
                src={selected.cover_image_url}
                alt={selected.name}
                className="w-full h-28 object-cover rounded-md mb-2"
              />
            )}
            <p className="font-semibold text-sm text-black leading-tight">
              {selected.name}
            </p>
            {selected.max_guests && (
              <p className="text-xs text-gray-500 mt-0.5">
                Up to {selected.max_guests} guests
              </p>
            )}
            {pricingMap[selected.id] && pricingMap[selected.id]!.room_rate_cents > 0 ? (
              <p className="text-xs font-semibold text-blue-600 mt-1">
                {fmtPrice(pricingMap[selected.id]!.total_cents)} total &rarr;
              </p>
            ) : (
              <p className="text-xs font-medium text-blue-600 mt-1">
                View &amp; Book &rarr;
              </p>
            )}
          </Link>
        </InfoWindowF>
      )}
    </GoogleMap>
  );
}

/* ------------------------------------------------------------------ */
/*  Search Results Page                                                */
/* ------------------------------------------------------------------ */

export default function SearchPage() {
  return (
    <Suspense>
      <SearchPageInner />
    </Suspense>
  );
}

function SearchPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialCheckIn = searchParams.get("check_in") || "";
  const initialCheckOut = searchParams.get("check_out") || "";
  const initialGuests = parseInt(searchParams.get("guests") || "2", 10);
  const initialPets = parseInt(searchParams.get("pets") || "0", 10);

  const [checkIn, setCheckIn] = useState(initialCheckIn);
  const [checkOut, setCheckOut] = useState(initialCheckOut);
  const [guests, setGuests] = useState(initialGuests);
  const [pets, setPets] = useState(initialPets);
  const [results, setResults] = useState<AvailableProperty[] | null>(null);
  const [mapProperties, setMapProperties] = useState<PropertyWithCoords[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false); // mobile map toggle
  const [pricingMap, setPricingMap] = useState<Record<string, { total_cents: number; room_rate_cents: number; min_stay_nights: number } | null>>({});
  const [browseAll, setBrowseAll] = useState<AvailableProperty[] | null>(null);

  const today = new Date().toISOString().split("T")[0];
  const hasSearchDates = !!(checkIn && checkOut);

  // When no search params, load all properties as browse mode
  useEffect(() => {
    if (initialCheckIn && initialCheckOut) return; // will run search instead
    const supabase = createClient();
    supabase
      .from("property")
      .select("id, name, slug, address, description, cover_image_url, max_guests")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        if (data) setBrowseAll(data);
      });
  }, [initialCheckIn, initialCheckOut]);

  const nights =
    checkIn && checkOut ? getNightCount(checkIn, checkOut) : null;

  const hasMapKey = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  // The active set of properties to display (search results or browse-all)
  const displayProperties = results ?? browseAll;

  // Geocode properties for map pins
  useEffect(() => {
    if (!hasMapKey || !displayProperties || displayProperties.length === 0) {
      setMapProperties([]);
      return;
    }

    let cancelled = false;

    async function geocodeAll() {
      // Wait for Google Maps to load
      let attempts = 0;
      while (
        (typeof google === "undefined" || !google.maps?.Geocoder) &&
        attempts < 30
      ) {
        await new Promise((r) => setTimeout(r, 300));
        attempts++;
      }
      if (typeof google === "undefined" || !google.maps?.Geocoder || cancelled) return;

      const geocoder = new google.maps.Geocoder();
      const withCoords: PropertyWithCoords[] = [];
      for (const prop of displayProperties!) {
        if (cancelled) return;
        if (!prop.address) continue;
        try {
          const res = await new Promise<google.maps.GeocoderResult[]>(
            (resolve, reject) => {
              geocoder.geocode({ address: prop.address! }, (r, s) => {
                if (s === "OK" && r) resolve(r);
                else reject(s);
              });
            }
          );
          const loc = res[0].geometry.location;
          withCoords.push({ ...prop, lat: loc.lat(), lng: loc.lng() });
        } catch {
          // Skip properties that can't be geocoded
        }
      }
      if (!cancelled) setMapProperties(withCoords);
    }

    geocodeAll();
    return () => { cancelled = true; };
  }, [displayProperties, hasMapKey]);

  // Fetch pricing for each result
  useEffect(() => {
    if (!results || results.length === 0 || !checkIn || !checkOut) return;
    let cancelled = false;

    async function fetchPricing() {
      const entries: Record<string, { total_cents: number; room_rate_cents: number; min_stay_nights: number } | null> = {};
      await Promise.all(
        results!.map(async (p) => {
          try {
            const params = new URLSearchParams({
              property_id: p.id,
              check_in: checkIn,
              check_out: checkOut,
              guests: String(guests),
              pets: String(pets),
            });
            const res = await fetch(`/api/checkout/pricing?${params}`);
            if (res.ok) {
              const data = await res.json();
              entries[p.id] = { total_cents: data.total_cents, room_rate_cents: data.room_rate_cents, min_stay_nights: data.min_stay_nights };
            } else {
              entries[p.id] = null;
            }
          } catch {
            entries[p.id] = null;
          }
        })
      );
      if (!cancelled) setPricingMap(entries);
    }

    fetchPricing();
    return () => { cancelled = true; };
  }, [results, checkIn, checkOut, guests, pets]);

  // Run search on mount if params are present
  useEffect(() => {
    if (initialCheckIn && initialCheckOut) {
      runSearch(initialCheckIn, initialCheckOut, initialGuests);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runSearch(ci: string, co: string, g: number) {
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const params = new URLSearchParams({
        check_in: ci,
        check_out: co,
        guests: String(g),
      });
      const res = await fetch(`/api/availability?${params}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong.");
      } else {
        setResults(data.available);
      }
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!checkIn || !checkOut) return;

    const params = new URLSearchParams({
      check_in: checkIn,
      check_out: checkOut,
      guests: String(guests),
      pets: String(pets),
    });
    router.replace(`/search?${params}`);
    runSearch(checkIn, checkOut, guests);
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <SiteNav />
      <div className="h-16" />

      {/* Map toggle (mobile) */}
      {hasMapKey && displayProperties && displayProperties.length > 0 && (
        <div className="flex justify-end px-4 sm:px-6 py-2 border-b bg-background">
          <button
            className="lg:hidden flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowMap(!showMap)}
          >
            {showMap ? (
              <>
                <List className="h-4 w-4" /> List
              </>
            ) : (
              <>
                <MapIcon className="h-4 w-4" /> Map
              </>
            )}
          </button>
        </div>
      )}

      {/* Search bar */}
      <div className="border-b bg-background px-4 sm:px-6 py-3">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_5rem_4.5rem_auto] items-end gap-x-3 gap-y-2 max-w-4xl mx-auto">
            <div className="space-y-1">
              <Label htmlFor="s-checkin" className="text-xs">
                Check-in
              </Label>
              <Input
                id="s-checkin"
                type="date"
                min={today}
                value={checkIn}
                onChange={(e) => {
                  setCheckIn(e.target.value);
                  if (checkOut && e.target.value >= checkOut) setCheckOut("");
                }}
                className="h-9 min-w-0"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="s-checkout" className="text-xs">
                Check-out
              </Label>
              <Input
                id="s-checkout"
                type="date"
                min={checkIn || today}
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                className="h-9 min-w-0"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="s-guests" className="text-xs">
                Guests
              </Label>
              <Input
                id="s-guests"
                type="number"
                min={1}
                max={30}
                value={guests}
                onChange={(e) => setGuests(parseInt(e.target.value) || 1)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="s-pets" className="text-xs">
                Pets
              </Label>
              <Input
                id="s-pets"
                type="number"
                min={0}
                max={3}
                value={pets}
                onChange={(e) => setPets(parseInt(e.target.value) || 0)}
                className="h-9"
              />
            </div>
            <Button type="submit" disabled={loading} size="sm" className="h-9 px-4 col-span-2 sm:col-span-1">
              <Search className="h-4 w-4 mr-1.5" />
              {loading ? "Searching..." : "Search"}
            </Button>
          </div>
        </form>
      </div>

      {/* Main content: list + map side by side */}
      <div className="flex-1 flex min-h-0">
        {/* Left: results list (scrollable) */}
        <div
          className={`flex-1 overflow-y-auto px-4 sm:px-6 py-6 ${
            showMap ? "hidden lg:block" : ""
          }`}
        >
          {/* Results header */}
          {(results !== null || loading) && (
            <div className="mb-5">
              {loading ? (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Checking availability across all homes...</span>
                </div>
              ) : results && results.length > 0 ? (
                <div>
                  <h1 className="text-xl font-bold tracking-tight">
                    {results.length} Home{results.length !== 1 ? "s" : ""}{" "}
                    Available
                  </h1>
                  <p className="text-muted-foreground text-sm mt-0.5">
                    {formatShortDate(checkIn)} &mdash;{" "}
                    {formatShortDate(checkOut)} &middot; {nights} night
                    {nights !== 1 ? "s" : ""} &middot; {guests} guest
                    {guests !== 1 ? "s" : ""}
                  </p>
                </div>
              ) : results && results.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <Calendar className="h-12 w-12 text-muted-foreground/30 mx-auto" />
                  <h1 className="text-2xl font-bold">
                    No homes available for these dates
                  </h1>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Try adjusting your dates or reducing the number of guests.
                  </p>
                </div>
              ) : null}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-destructive/10 text-destructive p-4 mb-6">
              {error}
            </div>
          )}

          {/* Results cards */}
          {results && results.length > 0 && (
            <div className="space-y-4">
              {results.map((property) => {
                const bookUrl = `/book/${property.slug}?check_in=${checkIn}&check_out=${checkOut}&guests=${guests}&pets=${pets}`;
                return (
                  <Link
                    key={property.id}
                    href={bookUrl}
                    className="block"
                    onMouseEnter={() => setHoveredId(property.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    <Card
                      className={`overflow-hidden group transition-all ${
                        hoveredId === property.id
                          ? "shadow-lg ring-2 ring-primary/30"
                          : "hover:shadow-md"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row">
                        <div className="relative w-full sm:w-56 h-44 sm:h-auto shrink-0">
                          {property.cover_image_url ? (
                            <img
                              src={property.cover_image_url}
                              alt={property.name}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <div className="w-full h-full bg-muted flex items-center justify-center">
                              <Mountain className="h-10 w-10 text-muted-foreground/30" />
                            </div>
                          )}
                          <Badge className="absolute top-3 left-3 bg-green-600 text-white border-0">
                            Available
                          </Badge>
                        </div>
                        <CardContent className="flex-1 p-4 flex flex-col justify-between">
                          <div>
                            <h3 className="font-semibold text-lg leading-tight">
                              {property.name}
                            </h3>
                            {property.address && (() => {
                              const parts = property.address.split(",").map(p => p.trim());
                              const general = parts.length >= 3 ? parts.slice(-3, -1).join(", ") : parts.length >= 2 ? parts.slice(-2).join(", ") : parts[0];
                              return general ? (
                                <p className="text-sm text-muted-foreground flex items-start gap-1.5 mt-1">
                                  <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                  <span className="line-clamp-1">{general}</span>
                                </p>
                              ) : null;
                            })()}
                            {property.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2 mt-1.5">
                                {property.description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center justify-between mt-3">
                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                              {property.max_guests && (
                                <span className="flex items-center gap-1">
                                  <Users className="h-3.5 w-3.5" />
                                  Up to {property.max_guests}
                                </span>
                              )}
                              <span>
                                {nights} night{nights !== 1 ? "s" : ""}
                              </span>
                            </div>
                            {pricingMap[property.id] !== undefined ? (
                              pricingMap[property.id] && pricingMap[property.id]!.room_rate_cents > 0 ? (
                                <span className="text-sm font-semibold text-primary flex items-center gap-1">
                                  {fmtPrice(pricingMap[property.id]!.total_cents)} total
                                  <Calendar className="h-3.5 w-3.5" />
                                </span>
                              ) : (
                                <span className="text-xs font-medium text-amber-600 text-right leading-tight">
                                  Extend by {pricingMap[property.id]!.min_stay_nights - nights!} night{pricingMap[property.id]!.min_stay_nights - nights! !== 1 ? "s" : ""}
                                  <br />
                                  <span className="text-[11px] text-amber-500">Min stay: {pricingMap[property.id]!.min_stay_nights} nights</span>
                                </span>
                              )
                            ) : (
                              <span className="text-sm font-semibold text-primary flex items-center gap-1">
                                Book Now
                                <Calendar className="h-3.5 w-3.5" />
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Browse all properties (no dates selected) */}
          {!results && !loading && !error && browseAll && browseAll.length > 0 && (
            <>
              <div className="mb-5">
                <h1 className="text-xl font-bold tracking-tight">
                  Our Homes
                </h1>
                <p className="text-muted-foreground text-sm mt-0.5">
                  Select your dates above to check availability and pricing
                </p>
              </div>
              <div className="space-y-4">
                {browseAll.map((property) => {
                  const browseUrl = `/book/${property.slug}`;
                  return (
                    <Link
                      key={property.id}
                      href={browseUrl}
                      className="block"
                      onMouseEnter={() => setHoveredId(property.id)}
                      onMouseLeave={() => setHoveredId(null)}
                    >
                      <Card
                        className={`overflow-hidden group transition-all ${
                          hoveredId === property.id
                            ? "shadow-lg ring-2 ring-primary/30"
                            : "hover:shadow-md"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row">
                          <div className="relative w-full sm:w-56 h-44 sm:h-auto shrink-0">
                            {property.cover_image_url ? (
                              <img
                                src={property.cover_image_url}
                                alt={property.name}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                              />
                            ) : (
                              <div className="w-full h-full bg-muted flex items-center justify-center">
                                <Mountain className="h-10 w-10 text-muted-foreground/30" />
                              </div>
                            )}
                          </div>
                          <CardContent className="flex-1 p-4 flex flex-col justify-between">
                            <div>
                              <h3 className="font-semibold text-lg leading-tight">
                                {property.name}
                              </h3>
                              {property.address && (() => {
                                const parts = property.address.split(",").map(p => p.trim());
                                const general = parts.length >= 3 ? parts.slice(-3, -1).join(", ") : parts.length >= 2 ? parts.slice(-2).join(", ") : parts[0];
                                return general ? (
                                  <p className="text-sm text-muted-foreground flex items-start gap-1.5 mt-1">
                                    <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                    <span className="line-clamp-1">{general}</span>
                                  </p>
                                ) : null;
                              })()}
                              {property.description && (
                                <p className="text-sm text-muted-foreground line-clamp-2 mt-1.5">
                                  {property.description}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center justify-between mt-3">
                              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                {property.max_guests && (
                                  <span className="flex items-center gap-1">
                                    <Users className="h-3.5 w-3.5" />
                                    Up to {property.max_guests}
                                  </span>
                                )}
                              </div>
                              <span className="text-sm font-medium text-primary flex items-center gap-1">
                                View Availability
                                <Calendar className="h-3.5 w-3.5" />
                              </span>
                            </div>
                          </CardContent>
                        </div>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </>
          )}

          {/* Empty state — only if no browse-all either */}
          {!results && !loading && !error && (!browseAll || browseAll.length === 0) && (
            <div className="text-center py-16 space-y-3">
              <Search className="h-12 w-12 text-muted-foreground/30 mx-auto" />
              <h1 className="text-2xl font-bold">
                Search for available homes
              </h1>
              <p className="text-muted-foreground max-w-md mx-auto">
                Enter your dates and number of guests above to see which homes
                are available for your trip.
              </p>
            </div>
          )}
        </div>

        {/* Right: map */}
        {hasMapKey && displayProperties && displayProperties.length > 0 && (
          <div
            className={`lg:w-[45%] xl:w-[50%] shrink-0 ${
              showMap ? "flex-1 w-full" : "hidden lg:block"
            }`}
          >
            <div className="h-full p-3 lg:pl-0">
              <ResultsMap
                properties={mapProperties}
                hoveredId={hoveredId}
                onHover={setHoveredId}
                checkIn={checkIn}
                checkOut={checkOut}
                guests={guests}
                pricingMap={pricingMap}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
