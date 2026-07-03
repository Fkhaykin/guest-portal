"use client";

import { useCallback, useMemo, useState } from "react";
import { GoogleMap, useJsApiLoader, MarkerF, InfoWindowF } from "@react-google-maps/api";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CompRow } from "./types";
import { fmtUsd } from "./types";

// Price-band pin colors, matching PriceLabs' competitor map legend.
const BANDS = [
  { max: 35000, color: "#93c5fd", label: "≤ $350" },
  { max: 47000, color: "#3b82f6", label: "$350–470" },
  { max: 63000, color: "#1e40af", label: "$470–630" },
  { max: 90000, color: "#eab308", label: "$630–900" },
  { max: Infinity, color: "#dc2626", label: "> $900" },
];

function bandColor(cents: number | null): string {
  if (cents == null) return "#9ca3af";
  return BANDS.find((b) => cents <= b.max)!.color;
}

export function CompetitorMap({
  comps,
  house,
}: {
  comps: CompRow[];
  house: { lat: number; lng: number } | null;
}) {
  const { isLoaded } = useJsApiLoader({
    id: "pricing-lab-map",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
  });
  const [active, setActive] = useState<string | null>(null);

  const pins = useMemo(
    () => comps.filter((c) => !c.is_self && c.lat != null && c.lng != null),
    [comps]
  );
  const center = house ?? (pins[0] ? { lat: pins[0].lat!, lng: pins[0].lng! } : { lat: 41.03, lng: -75.23 });

  const onLoad = useCallback(
    (map: google.maps.Map) => {
      const pts = [...pins.map((p) => ({ lat: p.lat!, lng: p.lng! })), ...(house ? [house] : [])];
      if (pts.length < 2) {
        map.setZoom(13);
        return;
      }
      const bounds = new google.maps.LatLngBounds();
      pts.forEach((p) => bounds.extend(p));
      map.fitBounds(bounds, 48);
    },
    [pins, house]
  );

  if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Competitor Map</CardTitle>
        <p className="text-sm text-muted-foreground">
          Your comp set around this house, pinned by average nightly price.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="h-[420px] w-full overflow-hidden rounded-lg border border-border">
          {!isLoaded ? (
            <div className="flex h-full items-center justify-center bg-muted">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <GoogleMap
              mapContainerClassName="h-full w-full"
              center={center}
              zoom={13}
              onLoad={onLoad}
              options={{ disableDefaultUI: true, zoomControl: true, clickableIcons: false }}
            >
              {house && (
                <MarkerF
                  position={house}
                  icon={{
                    path: 0, // google.maps.SymbolPath.CIRCLE
                    scale: 8,
                    fillColor: "#111827",
                    fillOpacity: 1,
                    strokeColor: "#ffffff",
                    strokeWeight: 2,
                  }}
                  zIndex={1000}
                  title="Your property"
                />
              )}
              {pins.map((c) => (
                <MarkerF
                  key={c.id}
                  position={{ lat: c.lat!, lng: c.lng! }}
                  onClick={() => setActive(c.id)}
                  icon={{
                    path: 0,
                    scale: 7,
                    fillColor: bandColor(c.stats.medianPriceCents),
                    fillOpacity: 0.95,
                    strokeColor: "#ffffff",
                    strokeWeight: 1.5,
                  }}
                >
                  {active === c.id && (
                    <InfoWindowF position={{ lat: c.lat!, lng: c.lng! }} onCloseClick={() => setActive(null)}>
                      <div className="max-w-48 text-xs">
                        <div className="font-medium">{c.label || `Listing ${c.airbnb_id}`}</div>
                        <div className="text-gray-600">
                          {c.bedrooms != null && `${c.bedrooms} BR · `}
                          {c.stats.medianPriceCents != null ? `${fmtUsd(c.stats.medianPriceCents)}/night median` : "not priced yet"}
                        </div>
                        {c.rating != null && (
                          <div className="text-gray-600">
                            ★ {c.rating} ({c.review_count ?? 0})
                          </div>
                        )}
                      </div>
                    </InfoWindowF>
                  )}
                </MarkerF>
              ))}
            </GoogleMap>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-full border border-white bg-gray-900" /> Your property
          </span>
          {BANDS.map((b) => (
            <span key={b.label} className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-full" style={{ background: b.color }} /> {b.label}
            </span>
          ))}
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-full bg-gray-400" /> not priced
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
