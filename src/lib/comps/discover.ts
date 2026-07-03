// Automatic comp discovery — the same selection PriceLabs does (bedroom-matched
// listings within a radius, nearest-neighbor ranked), scaled to a hand-checkable
// list. Source: Airbnb's map-bounds search page, whose SSR HTML embeds the full
// StaySearchResult array (id, name, coordinates, beds, rating, price).

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export interface ListingProfile {
  lat: number;
  lng: number;
  bedrooms: number | null;
}

export interface CompCandidate {
  airbnbId: string;
  name: string;
  lat: number;
  lng: number;
  beds: number | null;
  rating: number | null;
  reviewCount: number;
  distanceKm: number;
  priceTotal: string | null; // informational — search-window total
  score: number; // lower = better comp
}

/** Lat/lng + bedrooms of a listing, scraped from its own PDP page. Used to
 *  anchor discovery on the house's own Airbnb listing. */
export async function getListingProfile(airbnbId: string): Promise<ListingProfile> {
  const res = await fetch(`https://www.airbnb.com/rooms/${airbnbId}`, {
    headers: { "User-Agent": UA, Accept: "text/html" },
  });
  if (!res.ok) throw new Error(`Airbnb rooms page ${res.status}`);
  const html = await res.text();
  const lat = html.match(/"lat":\s*(-?\d+\.\d+)/);
  const lng = html.match(/"lng":\s*(-?\d+\.\d+)/);
  const beds = html.match(/(\d+)\s*bedrooms?/);
  if (!lat || !lng) throw new Error("Could not extract listing coordinates");
  return {
    lat: parseFloat(lat[1]),
    lng: parseFloat(lng[1]),
    bedrooms: beds ? parseInt(beds[1], 10) : null,
  };
}

/** One map-bounds search; returns the raw embedded results. */
async function searchBounds(
  center: { lat: number; lng: number },
  radiusKm: number,
  minBedrooms: number
): Promise<CompCandidate[]> {
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.cos((center.lat * Math.PI) / 180));
  const params = new URLSearchParams({
    "refinement_paths[]": "/homes",
    search_type: "user_map_move",
    ne_lat: String(center.lat + dLat),
    ne_lng: String(center.lng + dLng),
    sw_lat: String(center.lat - dLat),
    sw_lng: String(center.lng - dLng),
    zoom: "12",
    search_by_map: "true",
    min_bedrooms: String(minBedrooms),
  });
  const res = await fetch(`https://www.airbnb.com/s/homes?${params}`, {
    headers: { "User-Agent": UA, Accept: "text/html" },
  });
  if (!res.ok) throw new Error(`Airbnb search ${res.status}`);
  const html = await res.text();

  const anchor = html.indexOf('"searchResults":[');
  if (anchor < 0) return [];
  const arr = balancedArray(html, anchor + '"searchResults":'.length);
  if (!arr) return [];

  type RawResult = {
    avgRatingLocalized?: string | null;
    structuredContent?: unknown;
    structuredDisplayPrice?: unknown;
    demandStayListing?: {
      id?: string;
      location?: { coordinate?: { latitude?: number; longitude?: number } };
      description?: { name?: { localizedStringWithTranslationPreference?: string } };
    };
  };
  let results: RawResult[];
  try {
    results = JSON.parse(arr) as RawResult[];
  } catch {
    return [];
  }

  const out: CompCandidate[] = [];
  for (const r of results) {
    const d = r.demandStayListing;
    if (!d?.id) continue;
    let airbnbId: string;
    try {
      airbnbId = Buffer.from(d.id, "base64").toString().split(":").pop() ?? "";
    } catch {
      continue;
    }
    const lat = d.location?.coordinate?.latitude;
    const lng = d.location?.coordinate?.longitude;
    if (!airbnbId || lat == null || lng == null) continue;

    const ratingStr = r.avgRatingLocalized ?? "";
    const ratingMatch = ratingStr.match(/([\d.]+)\s*\((\d+)\)/);
    const bedsMatch = JSON.stringify(r.structuredContent ?? {}).match(/(\d+) bed/);
    const priceMatch = JSON.stringify(r.structuredDisplayPrice ?? {}).match(/\$[\d,]+/);

    out.push({
      airbnbId,
      name: d.description?.name?.localizedStringWithTranslationPreference ?? `Listing ${airbnbId}`,
      lat,
      lng,
      beds: bedsMatch ? parseInt(bedsMatch[1], 10) : null,
      rating: ratingMatch ? parseFloat(ratingMatch[1]) : null,
      reviewCount: ratingMatch ? parseInt(ratingMatch[2], 10) : 0,
      distanceKm: haversineKm(center.lat, center.lng, lat, lng),
      priceTotal: priceMatch ? priceMatch[0] : null,
      score: 0,
    });
  }
  return out;
}

/** Discover comp candidates around a house, PriceLabs-style: bedroom-matched,
 *  radius-bounded, nearest-neighbor ranked. Two sweeps (tight + wide radius)
 *  broaden the pool; ranking prefers same-size, nearby, well-reviewed listings. */
export async function discoverComps(
  profile: ListingProfile,
  excludeIds: Set<string>,
  limit = 12
): Promise<CompCandidate[]> {
  const minBedrooms = Math.max(1, (profile.bedrooms ?? 3) - 1);
  const center = { lat: profile.lat, lng: profile.lng };

  const sweeps = await Promise.all([
    searchBounds(center, 8, minBedrooms),
    searchBounds(center, 15, minBedrooms),
  ]);
  const byId = new Map<string, CompCandidate>();
  for (const c of sweeps.flat()) {
    if (excludeIds.has(c.airbnbId)) continue;
    if (!byId.has(c.airbnbId)) byId.set(c.airbnbId, c);
  }

  const candidates = [...byId.values()];
  for (const c of candidates) {
    const bedGap =
      profile.bedrooms != null && c.beds != null ? Math.abs(c.beds - profile.bedrooms) : 1;
    // KNN-ish score: size match dominates, then distance; an established review
    // history discounts the score (a "New" listing is a weaker price signal).
    c.score =
      bedGap * 3 + c.distanceKm / 3 - Math.min(Math.log10(c.reviewCount + 1), 2);
  }
  candidates.sort((a, b) => a.score - b.score);
  return candidates.slice(0, limit);
}

function balancedArray(s: string, start: number): string | null {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (ch === "\\") {
      esc = true;
      continue;
    }
    if (ch === '"') {
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;
    if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}
