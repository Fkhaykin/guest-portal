import type { Promo } from "@/lib/promo/types";

// ---------------------------------------------------------------------------
// Payload of GET /api/kiosk/[token]
// ---------------------------------------------------------------------------

export interface KioskWeatherDay {
  date: string;
  tempMaxF: number | null;
  precipProb: number | null;
  label: string;
  emoji: string;
}

export interface KioskBooking {
  first_name: string;
  guest_name: string | null;
  guest_token: string;
  reservation: {
    id: string;
    check_in_date: string;
    check_out_date: string;
    num_guests: number | null;
    signature_url: string | null;
    booking_source: string | null;
    property: { slug: string; name: string };
    lodgify: { check_in_time: string | null; check_out_time: string | null } | null;
  } & Record<string, unknown>;
}

// Next arrival, present only while the house is vacant (state === "none") —
// it feeds the cleaner welcome screen.
export interface KioskNextBooking {
  check_in_date: string;
  check_out_date: string;
  // Pre-formatted, e.g. "4:00 PM" — honors a paid early check-in.
  check_in_time: string;
  first_name: string | null;
  num_guests: number | null;
  pets: number;
}

export interface KioskData {
  property: {
    id: string;
    name: string;
    slug: string;
    address: string | null;
    timezone: string;
    community: "penn-estates" | "blue-mountain-lake";
    host_phone: string | null;
  };
  today: string;
  state: "arrival_day" | "mid_stay" | "checkout_day" | "none";
  photos: string[];
  weather: KioskWeatherDay[] | null;
  booking: KioskBooking | null;
  next_booking: KioskNextBooking | null;
  // Short calendar of future stays for the cleaner screen; empty unless state
  // is "none". First entry mirrors next_booking.
  upcoming_bookings: KioskNextBooking[];
  // Assigned cleaner's first name — the vacant-house greeting. Null unless
  // state is "none".
  cleaner_name: string | null;
  // Seconds until the next screen-flip boundary (a checkout time, a check-in
  // time, or midnight) — the client refetches then.
  refresh_in_seconds: number;
  house_photo_count: number;
}

// A guest's own photo booth shot (kiosk album view).
export interface KioskGuestPhoto {
  id: string;
  status: "guest_approved" | "published" | "rejected";
  url: string | null;
  created_at: string;
}

// A published house-album photo.
export interface KioskHousePhoto {
  id: string;
  url: string;
  taken_by_name: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Payload of GET /api/kiosk/[token]/content
// ---------------------------------------------------------------------------

export interface KioskFaq {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  sort_order: number;
}

export interface KioskVideo {
  id: string;
  title: string;
  description: string | null;
  sort_order: number;
}

export interface KioskService {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  image_url: string | null;
  sort_order: number;
}

export interface KioskContent {
  faqs: KioskFaq[];
  videos: KioskVideo[];
  services: KioskService[];
  promos: Promo[];
}

// ---------------------------------------------------------------------------
// Payload of GET /api/kiosk/[token]/weather
// ---------------------------------------------------------------------------

export interface KioskWeatherCurrent {
  time: string;
  tempF: number | null;
  feelsF: number | null;
  humidity: number | null;
  precipIn: number | null;
  cloudCover: number | null;
  windMph: number | null;
  windGustMph: number | null;
  windDir: number | null;
  isDay: boolean;
  code: number | null;
  label: string;
  emoji: string;
}

export interface KioskWeatherHour {
  time: string;
  tempF: number | null;
  feelsF: number | null;
  precipProb: number | null;
  precipIn: number | null;
  humidity: number | null;
  windMph: number | null;
  uv: number | null;
  isDay: boolean;
  code: number | null;
  label: string;
  emoji: string;
}

export interface KioskWeatherDaily {
  date: string;
  tempMaxF: number | null;
  tempMinF: number | null;
  precipProb: number | null;
  precipIn: number | null;
  sunrise: string;
  sunset: string;
  uvMax: number | null;
  windMaxMph: number | null;
  code: number | null;
  label: string;
  emoji: string;
}

export interface KioskWeatherFull {
  location: { lat: number; lng: number; name: string };
  current: KioskWeatherCurrent | null;
  hourly: KioskWeatherHour[];
  daily: KioskWeatherDaily[];
  radar: { host: string; frames: { time: number; path: string }[] } | null;
}

// ---------------------------------------------------------------------------
// Screen router
// ---------------------------------------------------------------------------

export type KioskScreen =
  | { kind: "attract" }
  | { kind: "home" }
  | { kind: "weather" }
  | { kind: "rules" }
  | { kind: "faq" }
  | { kind: "videos" }
  | { kind: "video"; id: string }
  | { kind: "services" }
  | { kind: "promos" }
  | { kind: "explore" }
  | { kind: "tip" }
  | { kind: "phone" }
  | { kind: "photobooth" }
  | { kind: "guest-album" }
  | { kind: "house-album"; from?: "photobooth" };
