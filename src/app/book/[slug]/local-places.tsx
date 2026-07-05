"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GoogleMap, Marker, Polyline, useJsApiLoader } from "@react-google-maps/api";
import {
  ExternalLink,
  FerrisWheel,
  MountainSnow,
  Navigation,
  ShoppingBag,
  TreePine,
  UtensilsCrossed,
  Waves,
  X,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Curated local places — coordinates verified against OSM/Google,    */
/*  July 2026. All within ~30 straight-line miles of the houses.       */
/* ------------------------------------------------------------------ */

export type PlaceCategory = "ski" | "water" | "hiking" | "family" | "food" | "towns";

export type LocalPlace = {
  name: string;
  category: PlaceCategory;
  hook: string;
  lat: number;
  lng: number;
};

export const LOCAL_PLACES: LocalPlace[] = [
  // Ski & snow
  { name: "Camelback Mountain Resort", category: "ski", hook: "The Poconos' biggest ski hill — trails, tubing, night skiing", lat: 41.0523, lng: -75.3454 },
  { name: "Shawnee Mountain Ski Area", category: "ski", hook: "Family-friendly slopes minutes away — ideal for first-timers", lat: 41.0338, lng: -75.0725 },
  { name: "Jack Frost Mountain", category: "ski", hook: "Quiet wooded trails and terrain parks without the crowds", lat: 41.1104, lng: -75.6519 },
  { name: "Big Boulder", category: "ski", hook: "Pennsylvania's first commercial ski area, now a terrain-park hub", lat: 41.0467, lng: -75.5998 },
  { name: "Blue Mountain Resort", category: "ski", hook: "Pennsylvania's biggest vertical drop — 1,082 feet of it", lat: 40.8167, lng: -75.5098 },
  // Water fun
  { name: "Camelbeach Mountain Waterpark", category: "water", hook: "Pennsylvania's largest outdoor waterpark, 37 slides on a mountainside", lat: 41.0511, lng: -75.3557 },
  { name: "Aquatopia Indoor Waterpark", category: "water", hook: "125,000 sq ft of indoor slides, a balmy 84° all year", lat: 41.0532, lng: -75.3456 },
  { name: "Kalahari Resorts Poconos", category: "water", hook: "America's largest indoor waterpark — day passes available", lat: 41.1, lng: -75.391 },
  { name: "Great Wolf Lodge", category: "water", hook: "The wolf-themed indoor waterpark little kids never forget", lat: 41.0599, lng: -75.3218 },
  { name: "Shawnee River Trips", category: "water", hook: "Lazy raft, canoe, and tube floats down the Delaware", lat: 41.0065, lng: -75.1108 },
  { name: "Pocono Whitewater", category: "water", hook: "Guided whitewater rafting through the Lehigh Gorge rapids", lat: 40.9467, lng: -75.6537 },
  { name: "Lake Wallenpaupack", category: "water", hook: "13-mile lake — pontoon rentals, marinas, and lakeside ice cream", lat: 41.4494, lng: -75.1791 },
  // Hiking & nature
  { name: "Bushkill Falls", category: "hiking", hook: "The “Niagara of Pennsylvania” — eight waterfalls on wooden boardwalks", lat: 41.1172, lng: -75.0101 },
  { name: "Delaware Water Gap (Kittatinny Point)", category: "hiking", hook: "Postcard views where the Delaware slices through the ridge", lat: 40.9702, lng: -75.1282 },
  { name: "Raymondskill Falls", category: "hiking", hook: "Pennsylvania's tallest waterfall, three tiers deep in the forest", lat: 41.2901, lng: -74.8412 },
  { name: "Dingmans Falls", category: "hiking", hook: "Flat boardwalk stroll to a 130-foot cascade", lat: 41.2308, lng: -74.8925 },
  { name: "Mount Tammany", category: "hiking", hook: "Steep red-dot scramble to the Gap's most famous overlook", lat: 40.9695, lng: -75.1109 },
  { name: "Big Pocono State Park", category: "hiking", hook: "Drive-up summit with views across three states", lat: 41.0399, lng: -75.3509 },
  { name: "Hickory Run Boulder Field", category: "hiking", hook: "A surreal 16-acre sea of Ice Age boulders", lat: 41.05, lng: -75.645 },
  { name: "Tobyhanna State Park", category: "hiking", hook: "Gentle five-mile lakeside loop with summer boat rentals", lat: 41.2246, lng: -75.4101 },
  { name: "Promised Land State Park", category: "hiking", hook: "Two spring-fed lakes, easy trails, and dark-sky stargazing", lat: 41.3117, lng: -75.2058 },
  // Family fun
  { name: "Claws 'N' Paws Wild Animal Park", category: "family", hook: "120+ animals with keeper feedings and a dino dig", lat: 41.4009, lng: -75.3397 },
  { name: "Costa's Family Fun Park", category: "family", hook: "Go-karts, bumper boats, mini-golf, and batting cages", lat: 41.4254, lng: -75.123 },
  { name: "Pocono TreeVentures", category: "family", hook: "Aerial ropes courses and zip lines through the treetops", lat: 41.072, lng: -75.0366 },
  { name: "Camelback Mountain Adventures", category: "family", hook: "Mountain coaster, zip lines, and summer tubing runs", lat: 41.0519, lng: -75.3511 },
  { name: "Quiet Valley Living Historical Farm", category: "family", hook: "A working 1800s homestead with costumed guides and barn animals", lat: 40.9576, lng: -75.2507 },
  { name: "Pocono Snake & Animal Farm", category: "family", hook: "Old-school roadside zoo — king cobras to a 24-foot python", lat: 41.0227, lng: -75.1289 },
  // Food & drink
  { name: "Barley Creek Brewing Company", category: "food", hook: "Slope-side brewpub — house ales and hearty tavern fare", lat: 41.0524, lng: -75.3289 },
  { name: "ShawneeCraft Brewing", category: "food", hook: "Small-batch ales in a rustic barn at the Shawnee Inn", lat: 41.0072, lng: -75.1113 },
  { name: "Sarah Street Grill", category: "food", hook: "Stroudsburg staple — sushi bar, craft taps, live music", lat: 40.9868, lng: -75.192 },
  { name: "Compton's Pancake House", category: "food", hook: "The beloved breakfast institution — expect a weekend line", lat: 40.9819, lng: -75.1909 },
  { name: "Village Farmer & Bakery", category: "food", hook: "Home of the famous hot dog and apple pie combo", lat: 40.986, lng: -75.1445 },
  { name: "Callie's Candy Kitchen", category: "food", hook: "Third-generation candy shop famous for Pocono Mountain Bark", lat: 41.179, lng: -75.2697 },
  // Shopping & towns
  { name: "The Crossings Premium Outlets", category: "towns", hook: "100+ outlet stores in the heart of the Poconos", lat: 41.0457, lng: -75.3118 },
  { name: "Downtown Stroudsburg", category: "towns", hook: "Walkable Main Street of boutiques, cafés, and galleries", lat: 40.9856, lng: -75.1946 },
  { name: "Historic Jim Thorpe", category: "towns", hook: "Victorian mountain town dubbed the “Switzerland of America”", lat: 40.8636, lng: -75.7387 },
  { name: "Mount Airy Casino Resort", category: "towns", hook: "Vegas-style gaming, spa, and golf in the mountains", lat: 41.1132, lng: -75.3218 },
  { name: "Pocono Raceway", category: "towns", hook: "NASCAR's “Tricky Triangle” — race weekends and track experiences", lat: 41.0605, lng: -75.5118 },
];

/* ------------------------------------------------------------------ */
/*  Categories — marker glyphs are the lucide icon paths inlined so    */
/*  they can be baked into SVG data-URI map markers                    */
/* ------------------------------------------------------------------ */

type CategoryMeta = {
  id: PlaceCategory;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  glyph: string;
};

const CATEGORIES: CategoryMeta[] = [
  {
    id: "ski",
    label: "Ski & snow",
    icon: MountainSnow,
    color: "#0284c7",
    glyph: '<path d="m8 3 4 8 5-5 5 15H2L8 3z"/><path d="M4.14 15.08c2.62-1.57 5.24-1.43 7.86.42 2.74 1.94 5.49 2 8.23.19"/>',
  },
  {
    id: "water",
    label: "Water fun",
    icon: Waves,
    color: "#0d9488",
    glyph: '<path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>',
  },
  {
    id: "hiking",
    label: "Hiking & nature",
    icon: TreePine,
    color: "#16a34a",
    glyph: '<path d="m17 14 3 3.3a1 1 0 0 1-.7 1.7H4.7a1 1 0 0 1-.7-1.7L7 14h-.3a1 1 0 0 1-.7-1.7L9 9h-.2A1 1 0 0 1 8 7.3L12 3l4 4.3a1 1 0 0 1-.8 1.7H15l3 3.3a1 1 0 0 1-.7 1.7H17Z"/><path d="M12 22v-3"/>',
  },
  {
    id: "family",
    label: "Family fun",
    icon: FerrisWheel,
    color: "#9333ea",
    glyph: '<circle cx="12" cy="12" r="2"/><path d="M12 2v4"/><path d="m6.8 15-3.5 2"/><path d="m20.7 7-3.5 2"/><path d="M6.8 9 3.3 7"/><path d="m20.7 17-3.5-2"/><path d="m9 22 3-8 3 8"/><path d="M8 22h8"/><path d="M18 18.7a9 9 0 1 0-12 0"/>',
  },
  {
    id: "food",
    label: "Food & drink",
    icon: UtensilsCrossed,
    color: "#ea580c",
    glyph: '<path d="m16 2-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8"/><path d="M15 15 3.3 3.3a4.2 4.2 0 0 0 0 6l7.3 7.3c.7.7 2 .7 2.8 0L15 15Zm0 0 7 7"/><path d="m2.1 21.8 6.4-6.3"/><path d="m19 5-7 7"/>',
  },
  {
    id: "towns",
    label: "Shopping & towns",
    icon: ShoppingBag,
    color: "#e11d48",
    glyph: '<path d="M16 10a4 4 0 0 1-8 0"/><path d="M3.103 6.034h17.794"/><path d="M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z"/>',
  },
];

const CATEGORY_META = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<
  PlaceCategory,
  CategoryMeta
>;

/* ------------------------------------------------------------------ */
/*  Distance helpers                                                   */
/* ------------------------------------------------------------------ */

type LatLng = { lat: number; lng: number };

function haversineMiles(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 3958.8 * Math.asin(Math.sqrt(s));
}

// Winding Pocono roads run ~1.3× the straight line at ~34 mph average.
function driveMinutes(miles: number): number {
  return Math.max(5, Math.round(((miles * 1.3) / 34) * 60 / 5) * 5);
}

function driveChipClass(mins: number): string {
  if (mins < 15) return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
  if (mins < 35) return "bg-amber-500/10 text-amber-700 dark:text-amber-400";
  return "bg-muted text-muted-foreground";
}

function directionsUrl(house: LatLng, place: LatLng): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${house.lat},${house.lng}&destination=${place.lat},${place.lng}`;
}

/* ------------------------------------------------------------------ */
/*  Map markers                                                        */
/* ------------------------------------------------------------------ */

// Same pin as the rest of the site — the house is the fixed reference point.
const HOUSE_PIN_URL = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="52" viewBox="0 0 44 52">
    <path d="M22 0C10 0 0 10 0 22c0 16 22 30 22 30s22-14 22-30C44 10 34 0 22 0z" fill="#2d6a8f"/>
    <circle cx="22" cy="20" r="11" fill="white"/>
    <text x="22" y="26" text-anchor="middle" font-size="16" fill="#2d6a8f">&#8962;</text>
  </svg>`
)}`;

function categoryMarkerUrl(cat: CategoryMeta): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34">
      <circle cx="17" cy="17" r="15" fill="${cat.color}" stroke="white" stroke-width="2.5"/>
      <g transform="translate(9 9) scale(0.6667)" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${cat.glyph}</g>
    </svg>`
  )}`;
}

// Dash segment for the house→place line; color inherits from the polyline.
const DASH_SYMBOL: google.maps.Symbol = {
  path: "M 0,-1 0,1",
  strokeOpacity: 1,
  strokeWeight: 2.5,
  scale: 3,
};

/* ------------------------------------------------------------------ */
/*  Explore-the-area section                                           */
/* ------------------------------------------------------------------ */

export function LocalPlacesSection({
  lat,
  lng,
  city,
  state,
}: {
  lat: number;
  lng: number;
  city: string | null;
  state: string | null;
}) {
  // Loader options must match every other useJsApiLoader call in the app.
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
  });
  const hasMap = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) && !loadError;

  const [category, setCategory] = useState<PlaceCategory>(CATEGORIES[0].id);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [cardsIn, setCardsIn] = useState(false);
  const [reducedMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  const mapRef = useRef<google.maps.Map | null>(null);
  const lineRef = useRef<google.maps.Polyline | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const houseLatLng = useMemo(() => ({ lat, lng }), [lat, lng]);

  const enriched = useMemo(
    () =>
      LOCAL_PLACES.map((p) => {
        const miles = haversineMiles(houseLatLng, p);
        return { ...p, miles, mins: driveMinutes(miles) };
      }),
    [houseLatLng]
  );
  const catPlaces = useMemo(
    () => enriched.filter((p) => p.category === category).sort((a, b) => a.miles - b.miles),
    [enriched, category]
  );
  const closest = useMemo(() => [...enriched].sort((a, b) => a.miles - b.miles).slice(0, 3), [enriched]);
  const selected = useMemo(
    () => catPlaces.find((p) => p.name === selectedName) ?? null,
    [catPlaces, selectedName]
  );

  const selectPlace = useCallback((place: LocalPlace) => {
    setCategory(place.category);
    setSelectedName(place.name);
  }, []);

  // Icon objects need google.maps constructors, so build them post-load.
  const icons = useMemo(() => {
    if (!isLoaded || typeof google === "undefined") return null;
    const place = {} as Record<PlaceCategory, google.maps.Icon>;
    const placeSelected = {} as Record<PlaceCategory, google.maps.Icon>;
    for (const c of CATEGORIES) {
      const url = categoryMarkerUrl(c);
      // anchor is in scaled-image pixels: keep it at the circle's center
      place[c.id] = { url, scaledSize: new google.maps.Size(34, 34), anchor: new google.maps.Point(17, 17) };
      placeSelected[c.id] = { url, scaledSize: new google.maps.Size(46, 46), anchor: new google.maps.Point(23, 23) };
    }
    return {
      house: {
        url: HOUSE_PIN_URL,
        scaledSize: new google.maps.Size(44, 52),
        anchor: new google.maps.Point(22, 52),
      } as google.maps.Icon,
      place,
      placeSelected,
    };
  }, [isLoaded]);

  const mapOptions = useMemo<google.maps.MapOptions | undefined>(() => {
    if (!isLoaded || typeof google === "undefined") return undefined;
    return {
      disableDefaultUI: true,
      zoomControl: true,
      // Keep zoom buttons clear of the floating place card at the bottom
      zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_TOP },
      gestureHandling: "cooperative",
      clickableIcons: false,
      styles: [
        { featureType: "poi", stylers: [{ visibility: "off" }] },
        { featureType: "transit", stylers: [{ visibility: "off" }] },
      ],
    };
  }, [isLoaded]);

  const fitTo = useCallback((points: LatLng[]) => {
    const map = mapRef.current;
    if (!map || typeof google === "undefined") return;
    const bounds = new google.maps.LatLngBounds();
    points.forEach((p) => bounds.extend(p));
    // Extra bottom room for the floating place card
    map.fitBounds(bounds, { top: 60, bottom: 96, left: 56, right: 56 });
  }, []);

  // Frame house+place when one is selected, otherwise the whole category.
  useEffect(() => {
    if (!mapReady) return;
    if (selected) fitTo([houseLatLng, { lat: selected.lat, lng: selected.lng }]);
    else fitTo([houseLatLng, ...catPlaces]);
  }, [mapReady, selected, catPlaces, houseLatLng, fitTo]);

  // March the dashes along the house→place line.
  useEffect(() => {
    if (!selectedName || reducedMotion) return;
    let raf = 0;
    let start: number | null = null;
    const step = (t: number) => {
      if (start === null) start = t;
      const offset = ((t - start) / 55) % 16;
      lineRef.current?.set("icons", [{ icon: DASH_SYMBOL, offset: `${offset}px`, repeat: "16px" }]);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [selectedName, reducedMotion]);

  // Bring the selected card into view (vertical list on desktop, row on mobile).
  useEffect(() => {
    if (!selectedName) return;
    const container = listRef.current;
    const el = cardRefs.current[selectedName];
    if (!container || !el) return;
    container.scrollTo({ top: el.offsetTop - 8, left: el.offsetLeft - 8, behavior: "smooth" });
  }, [selectedName]);

  // Stagger-fade the cards each time the category changes.
  useEffect(() => {
    setCardsIn(false);
    const t = setTimeout(() => setCardsIn(true), 30);
    return () => clearTimeout(t);
  }, [category]);

  const selectedMeta = selected ? CATEGORY_META[selected.category] : null;

  const renderChip = (p: (typeof enriched)[number]) => (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums ${driveChipClass(p.mins)}`}
    >
      <Navigation className="h-3 w-3" />
      {p.miles.toFixed(1)} mi · ~{p.mins} min drive
    </span>
  );

  const cardBase =
    "text-left shrink-0 rounded-xl border bg-card p-3.5 transition-all duration-300 motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-y-0";

  return (
    <section id="location" className="scroll-mt-32 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary mb-2">
        The area
      </p>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Where you&apos;ll be</h2>
          {city && (
            <p className="text-sm text-muted-foreground mt-1">
              {[city, state].filter(Boolean).join(", ")} — about 1.5 hours from NYC
            </p>
          )}
        </div>
        <a
          href={`https://www.google.com/maps?q=${lat},${lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline underline-offset-4"
        >
          Open in Google Maps <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <p className="text-sm text-muted-foreground">
        {LOCAL_PLACES.length}{" "}
        local favorites within an hour&apos;s drive — pick a category and tap a
        spot to see how far it is from the house.
      </p>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {CATEGORIES.map((c) => {
          const active = c.id === category;
          const count = LOCAL_PLACES.filter((p) => p.category === c.id).length;
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setCategory(c.id);
                setSelectedName(null);
              }}
              style={active ? { backgroundColor: c.color, borderColor: c.color } : undefined}
              className={`shrink-0 flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
                active ? "text-white" : "bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              <c.icon className={`h-4 w-4 ${active ? "" : "opacity-80"}`} />
              {c.label}
              <span
                className={`rounded-full px-1.5 py-px text-[11px] tabular-nums ${
                  active ? "bg-white/20" : "bg-muted"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Closest picks */}
      <div className="flex items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        <span className="shrink-0 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Closest picks
        </span>
        {closest.map((p) => (
          <button
            key={p.name}
            type="button"
            onClick={() => selectPlace(p)}
            className="shrink-0 flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs font-medium hover:border-foreground/25 transition-colors"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: CATEGORY_META[p.category].color }}
            />
            {p.name}
            <span className="text-muted-foreground tabular-nums">· {p.miles.toFixed(1)} mi</span>
          </button>
        ))}
      </div>

      {hasMap ? (
        <div className="grid gap-3 lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-4">
          {/* Place cards — horizontal row on mobile, scrollable column on desktop */}
          <div
            ref={listRef}
            className="relative order-2 lg:order-1 flex gap-3 overflow-x-auto snap-x pb-1 lg:flex-col lg:snap-none lg:overflow-x-hidden lg:overflow-y-auto lg:pb-0 lg:pr-1 lg:h-140"
            style={{ scrollbarWidth: "thin" }}
          >
            {catPlaces.map((p, i) => {
              const isSel = p.name === selectedName;
              return (
                <button
                  key={p.name}
                  type="button"
                  ref={(el) => {
                    cardRefs.current[p.name] = el;
                  }}
                  onClick={() => selectPlace(p)}
                  style={{
                    transitionDelay: cardsIn ? `${Math.min(i * 35, 350)}ms` : "0ms",
                    ...(isSel ? { borderColor: CATEGORY_META[p.category].color } : {}),
                  }}
                  className={`${cardBase} w-64 snap-start lg:w-auto hover:border-foreground/25 ${
                    cardsIn ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                  } ${isSel ? "shadow-md" : ""}`}
                >
                  <p className="text-sm font-semibold leading-tight">{p.name}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{p.hook}</p>
                  <div className="mt-2">{renderChip(p)}</div>
                </button>
              );
            })}
          </div>

          {/* Map */}
          <div className="relative order-1 lg:order-2 h-80 sm:h-96 lg:h-140 rounded-2xl overflow-hidden border">
            {isLoaded ? (
              <GoogleMap
                mapContainerClassName="w-full h-full"
                center={houseLatLng}
                zoom={11}
                options={mapOptions}
                onLoad={(map) => {
                  mapRef.current = map;
                  setMapReady(true);
                }}
                onUnmount={() => {
                  mapRef.current = null;
                  setMapReady(false);
                }}
              >
                {icons && (
                  <Marker position={houseLatLng} icon={icons.house} zIndex={30} title="The house" />
                )}
                {icons &&
                  catPlaces.map((p) => {
                    const isSel = p.name === selectedName;
                    return (
                      <Marker
                        key={`${category}-${p.name}`}
                        position={{ lat: p.lat, lng: p.lng }}
                        icon={isSel ? icons.placeSelected[p.category] : icons.place[p.category]}
                        zIndex={isSel ? 20 : 10}
                        title={p.name}
                        animation={reducedMotion ? undefined : google.maps.Animation.DROP}
                        onClick={() => selectPlace(p)}
                      />
                    );
                  })}
                {selected && selectedMeta && (
                  <Polyline
                    key={selected.name}
                    path={[houseLatLng, { lat: selected.lat, lng: selected.lng }]}
                    onLoad={(line) => {
                      lineRef.current = line;
                    }}
                    onUnmount={() => {
                      lineRef.current = null;
                    }}
                    options={{
                      geodesic: true,
                      strokeOpacity: 0,
                      strokeColor: selectedMeta.color,
                      zIndex: 5,
                      icons: [{ icon: DASH_SYMBOL, offset: "0px", repeat: "16px" }],
                    }}
                  />
                )}
              </GoogleMap>
            ) : (
              <div className="w-full h-full bg-muted animate-pulse" />
            )}

            {/* Floating place card */}
            {selected && selectedMeta && (
              <div className="absolute inset-x-3 bottom-3 sm:right-auto sm:max-w-xs rounded-xl border bg-card/95 backdrop-blur-sm p-3.5 shadow-lg space-y-1.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white"
                      style={{ backgroundColor: selectedMeta.color }}
                    >
                      <selectedMeta.icon className="h-3.5 w-3.5" />
                    </span>
                    <p className="text-sm font-semibold leading-tight">{selected.name}</p>
                  </div>
                  <button
                    type="button"
                    aria-label="Close"
                    onClick={() => setSelectedName(null)}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{selected.hook}</p>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                  {renderChip(selected)}
                  <a
                    href={directionsUrl(houseLatLng, selected)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline underline-offset-4"
                  >
                    Get directions <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* No Maps key / load error — cards alone, linking straight to directions */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {catPlaces.map((p, i) => (
            <a
              key={p.name}
              href={directionsUrl(houseLatLng, p)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ transitionDelay: cardsIn ? `${Math.min(i * 35, 350)}ms` : "0ms" }}
              className={`${cardBase} hover:border-foreground/25 ${
                cardsIn ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold leading-tight">{p.name}</p>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              </div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{p.hook}</p>
              <div className="mt-2">{renderChip(p)}</div>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
