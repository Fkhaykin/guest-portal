"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  Polyline,
  InfoWindow,
  OverlayView,
  OverlayViewF,
} from "@react-google-maps/api";

/* ------------------------------------------------------------------ */
/*  Coordinates                                                        */
/* ------------------------------------------------------------------ */

const NORTH_GATE = { lat: 41.04249, lng: -75.23297 }; // 525 Penn Estates Dr
const SOUTH_GATE = { lat: 41.02088, lng: -75.25446 }; // Cranberry Rd gate

const HALLET_START = { lat: 41.03513, lng: -75.2126 }; // Start of Hallet Rd approach
const CRANBERRY_START = { lat: 41.01724, lng: -75.24766 }; // Down Cranberry Rd

const MAP_CENTER = { lat: 41.032, lng: -75.243 };

const containerStyle = {
  width: "100%",
  height: "450px",
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
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Use Directions API to get a road-following route between two points */
function fetchRoute(
  service: google.maps.DirectionsService,
  origin: google.maps.LatLngLiteral,
  destination: google.maps.LatLngLiteral
): Promise<google.maps.LatLngLiteral[]> {
  return new Promise((resolve) => {
    service.route(
      {
        origin,
        destination,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === "OK" && result?.routes[0]) {
          const points = result.routes[0].overview_path.map((p) => ({
            lat: p.lat(),
            lng: p.lng(),
          }));
          resolve(points);
        } else {
          // Fallback: straight line
          resolve([origin, destination]);
        }
      }
    );
  });
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

/** BML route: simple A → B, no gates or wrong-way warning */
const BML_START = { lat: 41.01863342718482, lng: -75.18267911083335 };
const BML_HOME  = { lat: 41.04463402349529, lng: -75.19353370046814 };

interface GettingHereMapProps {
  propertyAddress?: string | null;
  /** "bml" = simple start-to-home route; default = Penn Estates gate route */
  variant?: "penn-estates" | "bml";
}

export function GettingHereMap({ propertyAddress, variant = "penn-estates" }: GettingHereMapProps) {
  const isBml = variant === "bml";
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
  });

  // Full road-following paths (fetched from Directions API)
  const leg1Full = useRef<google.maps.LatLngLiteral[]>([]);
  const leg2Full = useRef<google.maps.LatLngLiteral[]>([]);
  const wrongFull = useRef<google.maps.LatLngLiteral[]>([]);

  // Animated (progressively revealed) paths
  const [leg1Path, setLeg1Path] = useState<google.maps.LatLngLiteral[]>([]);
  const [leg2Path, setLeg2Path] = useState<google.maps.LatLngLiteral[]>([]);
  const [wrongPath, setWrongPath] = useState<google.maps.LatLngLiteral[]>([]);

  const [homeLocation, setHomeLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [routesReady, setRoutesReady] = useState(false);
  const [showPulse, setShowPulse] = useState(false);
  const [showLeg2Pulse, setShowLeg2Pulse] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);
  const [showNorthInfo, setShowNorthInfo] = useState(false);
  const [showSouthInfo, setShowSouthInfo] = useState(false);
  const [showHomeInfo, setShowHomeInfo] = useState(false);
  const [showDontGoHere, setShowDontGoHere] = useState(false);
  const [showGateTooltip, setShowGateTooltip] = useState(false);
  const [showHomeTooltip, setShowHomeTooltip] = useState(false);
  const [currentStep, setCurrentStep] = useState<0 | 1 | 2 | 3>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const mapRef = useRef<google.maps.Map | null>(null);

  /* Geocode property address */
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

  /* Fetch all road-following routes once map + home are ready */
  useEffect(() => {
    if (!isLoaded || routesReady) return;
    // Wait for homeLocation if we have an address, but don't block forever
    if (propertyAddress && !homeLocation) return;

    const service = new google.maps.DirectionsService();

    const fetchAll = async () => {
      if (isBml) {
        // BML: single route from start to home
        const dest = homeLocation || BML_HOME;
        leg1Full.current = await fetchRoute(service, BML_START, dest);
      } else {
        // Penn Estates: gate route + wrong route
        leg1Full.current = await fetchRoute(service, HALLET_START, NORTH_GATE);

        if (homeLocation) {
          leg2Full.current = await fetchRoute(service, NORTH_GATE, homeLocation);
        }

        wrongFull.current = await fetchRoute(service, CRANBERRY_START, SOUTH_GATE);
      }

      setRoutesReady(true);
    };

    fetchAll();
  }, [isLoaded, homeLocation, propertyAddress, routesReady, isBml]);

  /* Animate routes in sequence */
  const startAnimation = useCallback(() => {
    if (hasAnimated || !routesReady) return;
    setHasAnimated(true);

    const delay = (ms: number) =>
      new Promise<void>((resolve) => {
        timeoutRef.current = setTimeout(resolve, ms);
      });

    const animatePath = async (
      points: google.maps.LatLngLiteral[],
      setter: (p: google.maps.LatLngLiteral[]) => void,
      totalDurationMs: number
    ) => {
      if (points.length === 0) return;
      const interval = Math.max(totalDurationMs / points.length, 15);
      for (let i = 1; i <= points.length; i++) {
        setter(points.slice(0, i));
        await delay(interval);
      }
    };

    (async () => {
      if (isBml) {
        // BML: single animated route, then show home tooltip
        setCurrentStep(1);
        await delay(300);
        await animatePath(leg1Full.current, setLeg1Path, 2200);
        setShowLeg2Pulse(true);
        setShowHomeTooltip(true);
        await delay(1400);
        setShowHomeTooltip(false);
      } else {
        // Penn Estates: gate route + wrong route
        setCurrentStep(1);
        await delay(300);
        await animatePath(leg1Full.current, setLeg1Path, 1800);

        // Pause at gate — show gatehouse tooltip
        setShowPulse(true);
        setShowGateTooltip(true);
        await delay(1400);
        setShowGateTooltip(false);
        await delay(300);

        // Leg 2: North Gate → Home
        if (leg2Full.current.length > 0) {
          setCurrentStep(2);
          await animatePath(leg2Full.current, setLeg2Path, 1500);
          setShowLeg2Pulse(true);
          setShowHomeTooltip(true);
          await delay(1400);
          setShowHomeTooltip(false);
          await delay(300);
        }

        // Pan SW to reveal the wrong route area
        setCurrentStep(3);
        if (mapRef.current) {
          const fullBounds = new google.maps.LatLngBounds();
          fullBounds.extend(NORTH_GATE);
          fullBounds.extend(SOUTH_GATE);
          fullBounds.extend(HALLET_START);
          fullBounds.extend(CRANBERRY_START);
          if (homeLocation) fullBounds.extend(homeLocation);
          mapRef.current.panToBounds(fullBounds, { top: 60, bottom: 60, left: 50, right: 50 });
          // Also adjust zoom to fit everything
          mapRef.current.fitBounds(fullBounds, { top: 60, bottom: 60, left: 50, right: 50 });
        }
        await delay(800);

        // Wrong route (faded red)
        await animatePath(wrongFull.current, setWrongPath, 1200);

        // Show "DON'T GO HERE" tooltip on the wrong gate
        await delay(300);
        setShowDontGoHere(true);
      }
    })();
  }, [hasAnimated, routesReady, isBml]);

  /* Intersection Observer — trigger animation when visible */
  useEffect(() => {
    if (!routesReady || hasAnimated) return;
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          startAnimation();
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [routesReady, hasAnimated, startAnimation]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const onMapLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;
      const bounds = new google.maps.LatLngBounds();
      if (isBml) {
        bounds.extend(BML_START);
        bounds.extend(homeLocation || BML_HOME);
        map.fitBounds(bounds, { top: 60, bottom: 60, left: 50, right: 50 });
      } else {
        // Start zoomed in on the NE corner (routes 1 & 2)
        const neBounds = new google.maps.LatLngBounds();
        neBounds.extend(HALLET_START);
        neBounds.extend(NORTH_GATE);
        if (homeLocation) neBounds.extend(homeLocation);
        map.fitBounds(neBounds, { top: 80, bottom: 120, left: 80, right: 80 });
      }
    },
    [homeLocation, isBml]
  );

  if (!isLoaded) {
    return (
      <div className="w-full h-112.5 rounded-xl bg-muted animate-pulse flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading map...</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative space-y-2">
      {/* Step indicator */}
      {!isBml && (
        <div className="flex items-center gap-2 text-xs font-medium">
          <div
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full transition-colors ${
              currentStep >= 1
                ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                : "bg-muted text-muted-foreground"
            }`}
          >
            <span className="font-bold">1</span> Gate Pass
          </div>
          <div className="w-4 h-px bg-muted-foreground/30" />
          <div
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full transition-colors ${
              currentStep >= 2
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                : "bg-muted text-muted-foreground"
            }`}
          >
            <span className="font-bold">2</span> Your Home
          </div>
        </div>
      )}

      <GoogleMap
        mapContainerStyle={containerStyle}
        center={isBml ? { lat: (BML_START.lat + BML_HOME.lat) / 2, lng: (BML_START.lng + BML_HOME.lng) / 2 } : MAP_CENTER}
        zoom={14}
        options={mapOptions}
        onLoad={onMapLoad}
      >
        {/* Leg 1: route to gate (Penn Estates) or route to home (BML) */}
        {leg1Path.length > 1 && (
          <Polyline
            path={leg1Path}
            options={{
              strokeColor: isBml ? "#4285F4" : "#16a34a",
              strokeOpacity: 0.9,
              strokeWeight: 5,
            }}
          />
        )}

        {/* Leg 2: Gate → Home (blue, Penn Estates only) */}
        {!isBml && leg2Path.length > 1 && (
          <Polyline
            path={leg2Path}
            options={{
              strokeColor: "#4285F4",
              strokeOpacity: 0.85,
              strokeWeight: 5,
            }}
          />
        )}

        {/* Wrong route — faded red dashed (Penn Estates only) */}
        {!isBml && wrongPath.length > 1 && (
          <Polyline
            path={wrongPath}
            options={{
              strokeColor: "#EF4444",
              strokeOpacity: 0.5,
              strokeWeight: 4,
              icons: [
                {
                  icon: {
                    path: "M 0,-1 0,1",
                    strokeOpacity: 0.6,
                    scale: 3,
                  },
                  offset: "0",
                  repeat: "15px",
                },
              ],
            }}
          />
        )}

        {/* North Gate marker — Step 1 (green, Penn Estates only) */}
        {!isBml && (
          <>
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
            {/* Auto-show gatehouse tooltip */}
            {!showNorthInfo && (
              <OverlayViewF
                position={NORTH_GATE}
                mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
              >
                <div
                  className="transition-all duration-300 ease-in-out"
                  style={{
                    transform: "translate(-50%, 8px)",
                    opacity: showGateTooltip ? 1 : 0,
                    pointerEvents: showGateTooltip ? "auto" : "none",
                  }}
                >
                  <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg px-3 py-1.5 border border-green-200 max-w-55">
                    <p className="font-bold text-green-700 dark:text-green-400 text-sm leading-tight">
                      Gatehouse: 525 Penn Estates Dr
                    </p>
                  </div>
                </div>
              </OverlayViewF>
            )}
          </>
        )}

        {/* Home marker (blue) */}
        {(() => {
          const homePos = homeLocation || (isBml ? BML_HOME : null);
          const showHome = isBml ? homePos && currentStep >= 1 : homePos && currentStep >= 2;
          if (!showHome || !homePos) return null;
          return (
            <>
              <Marker
                position={homePos}
                icon={{
                  url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
                    `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="52" viewBox="0 0 44 52">
                      <path d="M22 0C10 0 0 10 0 22c0 16 22 30 22 30s22-14 22-30C44 10 34 0 22 0z" fill="#4285F4"/>
                      <circle cx="22" cy="20" r="11" fill="white"/>
                      <text x="22" y="25" text-anchor="middle" font-size="16" font-weight="bold" fill="#4285F4">${isBml ? "⌂" : "2"}</text>
                    </svg>`
                  )}`,
                  scaledSize: new google.maps.Size(44, 52),
                  anchor: new google.maps.Point(22, 52),
                }}
                onClick={() => setShowHomeInfo(!showHomeInfo)}
              />
              {showHomeInfo && (
                <InfoWindow position={homePos} onCloseClick={() => setShowHomeInfo(false)}>
                  <div className="p-1">
                    <p className="font-bold text-blue-700 text-sm">Your Home</p>
                    {!isBml && <p className="text-xs text-gray-500">Proceed here after gate pass</p>}
                  </div>
                </InfoWindow>
              )}
              {/* Auto-show home tooltip */}
              {!showHomeInfo && (
                <OverlayViewF
                  position={homePos}
                  mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                >
                  <div
                    className="transition-all duration-300 ease-in-out"
                    style={{
                      transform: "translate(-50%, 8px)",
                      opacity: showHomeTooltip ? 1 : 0,
                      pointerEvents: showHomeTooltip ? "auto" : "none",
                    }}
                  >
                    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg px-3 py-1.5 border border-blue-200 max-w-55">
                      <p className="font-bold text-blue-700 dark:text-blue-400 text-sm leading-tight">
                        Your Home
                      </p>
                    </div>
                  </div>
                </OverlayViewF>
              )}
            </>
          );
        })()}

        {/* South Gate marker — wrong entrance (Penn Estates only) */}
        {!isBml && (
          <>
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
            {showDontGoHere && !showSouthInfo && (
              <OverlayViewF
                position={SOUTH_GATE}
                mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
              >
                <div
                  className="transition-all duration-300 ease-in-out"
                  style={{ transform: "translate(-50%, 8px)" }}
                >
                  <div className="relative bg-white dark:bg-gray-900 rounded-lg shadow-lg px-3 py-1.5 border border-red-200">
                    <button
                      onClick={() => setShowDontGoHere(false)}
                      className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 hover:text-gray-700 text-xs leading-none"
                    >
                      ✕
                    </button>
                    <p className="font-black text-red-600 text-sm tracking-wide">
                      DON&apos;T GO HERE
                    </p>
                  </div>
                </div>
              </OverlayViewF>
            )}
          </>
        )}
      </GoogleMap>

      {/* Floating status badges */}
      <div className="absolute top-12 right-3 flex flex-col gap-2">
        {!isBml && showPulse && (
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
        {isBml ? (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-1 bg-blue-500 rounded" />
            <span>Route to Home</span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-1 bg-green-600 rounded" />
              <span>Hallet Rd → Gate</span>
            </div>
            {homeLocation && (
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-1 bg-blue-500 rounded" />
                <span>Gate → Home</span>
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
          </>
        )}
      </div>
    </div>
  );
}
