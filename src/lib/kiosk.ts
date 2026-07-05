import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

export interface KioskProperty {
  id: string;
  name: string;
  slug: string;
  nickname: string | null;
  address: string | null;
  timezone: string | null;
  cover_image_url: string | null;
}

/** Resolve a kiosk URL token to its property row, or null for unknown tokens. */
export async function resolveKioskProperty(
  admin: Admin,
  token: string
): Promise<KioskProperty | null> {
  const { data: kiosk } = await admin
    .from("kiosk")
    .select("property_id")
    .eq("token", token)
    .maybeSingle();
  if (!kiosk) return null;

  const { data: property } = await admin
    .from("property")
    .select("id, name, slug, nickname, address, timezone, cover_image_url")
    .eq("id", kiosk.property_id)
    .single();
  return (property as KioskProperty) ?? null;
}

// All houses sit in the same lake community — one fallback coordinate is
// meteorologically identical when a house has no is_self comp coords.
export const KIOSK_FALLBACK_COORDS = { lat: 41.032, lng: -75.237 };

/** A house's coordinates: its pricing self-comp row, else the community. */
export async function kioskCoords(
  admin: Admin,
  nickname: string | null
): Promise<{ lat: number; lng: number }> {
  if (nickname) {
    const { data: self } = await admin
      .from("comp_listing")
      .select("lat, lng")
      .ilike("nickname", nickname)
      .eq("is_self", true)
      .not("lat", "is", null)
      .limit(1)
      .maybeSingle();
    if (self?.lat != null && self?.lng != null) {
      return { lat: self.lat, lng: self.lng };
    }
  }
  return KIOSK_FALLBACK_COORDS;
}
