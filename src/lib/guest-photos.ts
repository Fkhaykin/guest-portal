import type { createAdminClient } from "@/lib/supabase/admin";
import { nicknamePropertyIds } from "@/lib/pricing/data";

// Published house-album photos, shared by the kiosk house-album screen, the
// kiosk payload's tile-visibility count, and the website album sections.
// Houses can span two property rows (active + legacy) that share a nickname, so
// album reads union across the whole nickname group.

type Admin = ReturnType<typeof createAdminClient>;

const BUCKET = "guest-photos";
const SIGNED_TTL = 3600; // 1h

export type PublishedPhoto = {
  id: string;
  url: string;
  taken_by_name: string | null;
  created_at: string;
};

/** The property IDs that make up a house (nickname group), or just its own. */
export async function housePropertyIds(
  admin: Admin,
  propertyId: string,
  nickname: string | null
): Promise<string[]> {
  const ids = nickname ? await nicknamePropertyIds(admin, nickname) : [propertyId];
  return ids.length ? ids : [propertyId];
}

export async function getPublishedHousePhotos(
  admin: Admin,
  opts: { propertyId: string; nickname: string | null; limit?: number }
): Promise<PublishedPhoto[]> {
  const ids = await housePropertyIds(admin, opts.propertyId, opts.nickname);
  const { data: rows } = await admin
    .from("guest_photo")
    .select("id, file_path, taken_by_name, created_at")
    .in("property_id", ids)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(opts.limit ?? 60);

  const signed = await Promise.all(
    (rows ?? []).map(async (r) => {
      const { data } = await admin.storage.from(BUCKET).createSignedUrl(r.file_path, SIGNED_TTL);
      return data?.signedUrl
        ? { id: r.id, url: data.signedUrl, taken_by_name: r.taken_by_name, created_at: r.created_at }
        : null;
    })
  );
  return signed.filter((p): p is PublishedPhoto => p !== null);
}

export async function countPublishedHousePhotos(
  admin: Admin,
  ids: string[]
): Promise<number> {
  const { count } = await admin
    .from("guest_photo")
    .select("id", { count: "exact", head: true })
    .in("property_id", ids)
    .eq("status", "published");
  return count ?? 0;
}
