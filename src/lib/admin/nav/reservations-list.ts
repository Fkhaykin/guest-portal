// Landing-page prefetch for the reservations LIST (`/admin/reservations`).
//
// The list page is fully client-rendered and fetches two INDEPENDENT datasets
// on mount — the property roster (filters + calendar grouping) and the full
// registration list. This module runs both in ONE Promise.all and stashes the
// combined result behind the shared prefetch cache, so a sidebar hover can warm
// it before the click and the page paints instantly on a warm hit.
//
// Mirrors src/lib/reservations/prefetch.ts (the row-hover detail cache), but
// keyed as a zero-arg singleton via createPrefetcher. Post-mutation refreshes
// (e.g. Lodgify sync) pass { force: true } to bypass and refresh the cache.

import { createClient } from "@/lib/supabase/client";
import { createPrefetcher } from "@/lib/prefetch-cache";
import type { GuestListEntry, PetEntry } from "@/types/database";

export type Property = {
  id: string;
  name: string;
  nickname: string | null;
  cover_image_url: string | null;
};

export type Registration = {
  id: string;
  property_id: string;
  check_in_date: string;
  check_out_date: string;
  num_guests: number;
  lodgify_adults: number;
  lodgify_children: number;
  lodgify_infants: number;
  lodgify_num_pets: number;
  status: "active" | "completed" | "cancelled";
  booking_source: string | null;
  signature_url: string | null;
  id_verification_status: string;
  id_name_match: boolean | null;
  total_amount_cents: number;
  guest_list: GuestListEntry[] | null;
  pets: PetEntry[] | null;
  created_at: string;
  updated_at: string;
  booked_at: string | null;
  guest: { full_name: string; email: string | null; phone: string | null } | null;
  property: { name: string; nickname: string | null; cover_image_url: string | null } | null;
};

// Both queries are independent, so run them together. Exact select/order mirror
// the page's original loadProperties() + loadRegistrations().
export async function fetchReservationsList(): Promise<{
  properties: Property[];
  registrations: Registration[];
}> {
  const supabase = createClient();
  const [propertiesRes, registrationsRes] = await Promise.all([
    supabase
      .from("property")
      .select("id, name, nickname, cover_image_url")
      .order("name"),
    supabase
      .from("registration")
      .select(
        "id, property_id, check_in_date, check_out_date, num_guests, lodgify_adults, lodgify_children, lodgify_infants, lodgify_num_pets, status, booking_source, signature_url, id_verification_status, id_name_match, total_amount_cents, guest_list, pets, created_at, updated_at, booked_at, guest:guest_id(full_name, email, phone), property:property_id(name, nickname, cover_image_url)"
      )
      .order("check_in_date", { ascending: false }),
  ]);
  return {
    properties: (propertiesRes.data as Property[] | null) ?? [],
    registrations:
      (registrationsRes.data as unknown as Registration[] | null) ?? [],
  };
}

export const reservationsListNav = createPrefetcher(
  () => "reservations-list",
  fetchReservationsList
);

export const prefetchReservationsList = () => reservationsListNav.prefetch();
