"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  Polyline,
  InfoWindow,
} from "@react-google-maps/api";

/* ------------------------------------------------------------------ */
/*  Coordinates                                                        */
/* ------------------------------------------------------------------ */

const NORTH_GATE = { lat: 41.04249, lng: -75.23297 }; // 525 Penn Estates Dr — CORRECT entrance
const SOUTH_GATE = { lat: 41.02088, lng: -75.25446 }; // South entrance off Cranberry Rd — WRONG way

const MAP_CENTER = { lat: 41.032, lng: -75.243 };

// Leg 1: Coming from Hallet Rd → North Gate
const ROUTE_TO_GATE = [
  { lat: 41.03513, lng: -75.21260 }, // Start of Hallet Rd approach
  NORTH_GATE,
];

// Wrong route: GPS sends you down Cranberry Rd to the south gate
const WRONG_ROUTE_PATH = [
  { lat: 41.01724, lng: -75.24766 }, // Coming down Cranberry Rd
  SOUTH_GATE,
];

const containerStyle = {
  width: "100%",
  height: "300px",
  borderRadius: "0.75rem",
};

const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: false,
  gestureHandling: "cooperative",
  styles: [
    { featureType: "poi", stylers: [{ visibility: "off" }] },
    { featureType: "transit", stylers: [{ visibility: "off" }] },
  ],
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface GettingHereMapProps {
  /** The full property address — used to geocode and show Leg 2 (gate → home) */
  propertyAddress?: string | null;
}

export function GettingHereMap({ propertyAddress }: GettingHereMapProps) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
  });

  const [leg1Path, setLeg1Path] = useState<google.maps.LatLngLiteral[]>([]);
  const [leg2Path, setLeg2Path] = useState<google.maps.LatLngLiteral[]>([]);
  const [wrongPath, setWrongPath] = useState<google.maps.LatLngLiteral[]>([]);
  const [homeLocation, setHomeLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [showPulse, setShowPulse] = useState(false);
  const [showLeg2Pulse, setShowLeg2Pulse] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);
  const [showNorthInfo, setShowNorthInfo] = useState(false);
  const [showSouthInfo, setShowSouthInfo] = useState(false);
  const [showHomeInfo, setShowHomeInfo] = useState(false);
  const [currentStep, setCurrentStep] = useState<0 | 1 | 2 | 3>(0); // 0=idle, 1=leg1, 2=leg2, 3=done
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const mapRef = useRef<google.maps.Map | null>(null);

  /* Geocode the property address to get leg 2 destination */
  useEffect(() => {
    if (!isLoaded || !propertyAddress) return;
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: propertyAddress }, (results, status) => {
      if (status === "OK" && results?.[0]) {
        const loc = results[0].geometry.location;
        setHomeLocation({ lat: loc.lat(), lng: loc.lng() });
      }
    });
  }, [isLoaded, propertyAddress]);

  /* Build leg 2 path: straight interpolated line from gate → home */
  const buildLeg2 = useCallback((): google.maps.LatLngLiteral[] => {
    if (!homeLocation) return [];
    const steps = 10;
    const path: google.maps.LatLngLiteral[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      path.push({
        lat: NORTH_GATE.lat + (homeLocation.lat - NORTH_GATE.lat) * t,
        lng: NORTH_GATE.lng + (homeLocation.lng - NORTH_GATE.lng) * t,
      });
    }
    return path;
  }, [homeLocation]);

  /* Animate everything in sequence */
  const startAnimation = useCallback(() => {
    if (hasAnimated) return;
    setHasAnimated(true);

    const delay = (ms: number) =>
      new Promise<void>((resolve) => {
        timeoutRef.current = setTimeout(resolve, ms);
      });

    const animatePath = async (
      points: google.maps.LatLngLiteral[],
      setter: (p: google.maps.LatLngLiteral[]) => void,
      intervalMs: number
    ) => {
      for (let i = 1; i <= points.length; i++) {
        setter(points.slice(0, i));
        await delay(intervalMs);
      }
    };

    (async () => {
      // Leg 1: Highway → North Gate
      setCurrentStep(1);
      await delay(400);
      await animatePath(ROUTE_TO_GATE, setLeg1Path, 120);

      // Pause at gate
      setShowPulse(true);
      await delay(1000);

      // Leg 2: North Gate → Home (if geocoded)
      const leg2Points = buildLeg2();
      if (leg2Points.length > 0) {
        setCurrentStep(2);
        await animatePath(leg2Points, setLeg2Path, 100);
        setShowLeg2Pulse(true);
        await delay(800);
      }

      // Show wrong route last (faded red)
      setCurrentStep(3);
      await animatePath(WRONG_ROUTE_PATH, setWrongPath, 100);
    })();
  }, [hasAnimated, buildLeg2]);

  /* Intersection Observer — trigger animation when visible */
  useEffect(() => {
    if (!isLoaded || hasAnimated) return;
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          startAnimation();
          observer.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isLoaded, hasAnimated, startAnimation]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  if (!isLoaded) {
    return (
      <div className="w-full h-75 rounded-xl bg-muted animate-pulse flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading map...</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative space-y-2">
      {/* Step indicator */}
      <div className="flex items-center gap-2 text-xs font-medium">
        <div
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full transition-colors ${
            currentStep >= 1
              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
              : "bg-muted text-muted-foreground"
          }`}
        >
          <span className="font-bold">1</span> Gate Pass
        </div>
        <div className="w-4 h-px bg-muted-foreground/30" />
        <div
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full transition-colors ${
            currentStep >= 2
              ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
              : "bg-muted text-muted-foreground"
          }`}
        >
          <span className="font-bold">2</span> Your Home
        </div>
      </div>

      <GoogleMap
        mapContainerStyle={containerStyle}
        center={MAP_CENTER}
        zoom={14}
        options={mapOptions}
        onLoad={onMapLoad}
      >
        {/* Leg 1: Highway → Gate (blue solid) */}
        {leg1Path.length > 1 && (
          <Polyline
            path={leg1Path}
            options={{
              strokeColor: "#4285F4",
              strokeOpacity: 0.9,
              strokeWeight: 5,
              geodesic: true,
            }}
          />
        )}

        {/* Leg 2: Gate → Home (green dashed) */}
        {leg2Path.length > 1 && (
          <Polyline
            path={leg2Path}
            options={{
              strokeColor: "#16a34a",
              strokeOpacity: 0.8,
              strokeWeight: 5,
              geodesic: true,
              icons: [
                {
                  icon: {
                    path: "M 0,-1 0,1",
                    strokeOpacity: 0.9,
                    scale: 3,
                  },
                  offset: "0",
                  repeat: "12px",
                },
              ],
            }}
          />
        )}

        {/* Wrong route — faded red dashed */}
        {wrongPath.length > 1 && (
          <Polyline
            path={wrongPath}
            options={{
              strokeColor: "#EF4444",
              strokeOpacity: 0.4,
              strokeWeight: 4,
              geodesic: true,
              icons: [
                {
                  icon: {
                    path: "M 0,-1 0,1",
                    strokeOpacity: 0.5,
                    scale: 3,
                  },
                  offset: "0",
                  repeat: "15px",
                },
              ],
            }}
          />
        )}

        {/* North Gate marker — Step 1 (green) */}
        <Marker
          position={NORTH_GATE}
          icon={{
            url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
              `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="52" viewBox="0 0 44 52">
                <path d="M22 0C10 0 0 10 0 22c0 16 22 30 22 30s22-14 22-30C44 10 34 0 22 0z" fill="#16a34a"/>
                <circle cx="22" cy="20" r="11" fill="white"/>
                <text x="22" y="25" text-anchor="middle" font-size="16" font-weight="bold" fill="#16a34a">1</text>
              </svg>`
            )}`,
            scaledSize: new google.maps.Size(44, 52),
            anchor: new google.maps.Point(22, 52),
          }}
          onClick={() => setShowNorthInfo(!showNorthInfo)}
        />
        {showNorthInfo && (
          <InfoWindow position={NORTH_GATE} onCloseClick={() => setShowNorthInfo(false)}>
            <div className="p-1">
              <p className="font-bold text-green-700 text-sm">Step 1: Main Gate (via Hallet Rd)</p>
              <p className="text-xs">525 Penn Estates Drive</p>
              <p className="text-xs text-gray-500">Show license &amp; get gate pass</p>
            </div>
          </InfoWindow>
        )}

        {/* Home marker — Step 2 (blue) */}
        {homeLocation && currentStep >= 2 && (
          <>
            <Marker
              position={homeLocation}
              icon={{
                url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
                  `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="52" viewBox="0 0 44 52">
                    <path d="M22 0C10 0 0 10 0 22c0 16 22 30 22 30s22-14 22-30C44 10 34 0 22 0z" fill="#4285F4"/>
                    <circle cx="22" cy="20" r="11" fill="white"/>
                    <text x="22" y="25" text-anchor="middle" font-size="16" font-weight="bold" fill="#4285F4">2</text>
                  </svg>`
                )}`,
                scaledSize: new google.maps.Size(44, 52),
                anchor: new google.maps.Point(22, 52),
              }}
              onClick={() => setShowHomeInfo(!showHomeInfo)}
            />
            {showHomeInfo && (
              <InfoWindow position={homeLocation} onCloseClick={() => setShowHomeInfo(false)}>
                <div className="p-1">
                  <p className="font-bold text-blue-700 text-sm">Step 2: Your Home</p>
                  <p className="text-xs text-gray-500">Proceed here after gate pass</p>
                </div>
              </InfoWindow>
            )}
          </>
        )}

        {/* South Gate marker — wrong entrance (red X) */}
        <Marker
          position={SOUTH_GATE}
          icon={{
            url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
              `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
                <path d="M18 0C8 0 0 8 0 18c0 14 18 26 18 26s18-12 18-26C36 8 28 0 18 0z" fill="#ef4444"/>
                <circle cx="18" cy="16" r="9" fill="white"/>
                <text x="18" y="21" text-anchor="middle" font-size="14" font-weight="bold" fill="#ef4444">✗</text>
              </svg>`
            )}`,
            scaledSize: new google.maps.Size(36, 44),
            anchor: new google.maps.Point(18, 44),
          }}
          onClick={() => setShowSouthInfo(!showSouthInfo)}
        />
        {showSouthInfo && (
          <InfoWindow position={SOUTH_GATE} onCloseClick={() => setShowSouthInfo(false)}>
            <div className="p-1">
              <p className="font-bold text-red-600 text-sm">Cranberry Rd Gate (Wrong Way)</p>
              <p className="text-xs text-gray-500">GPS often routes here — avoid!</p>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>

      {/* Floating status badges */}
      <div className="absolute top-12 right-3 flex flex-col gap-2">
        {showPulse && (
          <div className="flex items-center gap-2 bg-white/90 dark:bg-black/80 rounded-full px-3 py-1.5 shadow-md">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
            </span>
            <span className="text-xs font-medium">Get gate pass</span>
          </div>
        )}
        {showLeg2Pulse && (
          <div className="flex items-center gap-2 bg-white/90 dark:bg-black/80 rounded-full px-3 py-1.5 shadow-md">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
            </span>
            <span className="text-xs font-medium">Head to your home</span>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-1 bg-blue-500 rounded" />
          <span>Hallet Rd → Gate</span>
        </div>
        {homeLocation && (
          <div className="flex items-center gap-1.5">
            <div
              className="w-5 h-1 rounded"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(90deg, #16a34a 0, #16a34a 3px, transparent 3px, transparent 6px)",
              }}
            />
            <span>Gate to home</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <div
            className="w-5 h-1 rounded"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, #ef4444 0, #ef4444 3px, transparent 3px, transparent 6px)",
            }}
          />
          <span>Cranberry Rd (wrong)</span>
        </div>
      </div>
    </div>
  );
}
