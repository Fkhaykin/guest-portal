// Prefetch cache for the /admin/guest-photos landing load.
//
// The page fetches the moderation list on mount, so the click always paid a
// full round-trip. Routing that load through this shared prefetcher lets the
// sidebar warm it on hover (via `prefetchGuestPhotos`) so the page reads an
// already-resolved value and paints instantly. Post-mutation refreshes should
// pass { force: true } to `guestPhotosNav.get([])` to bypass the cache.

import { createPrefetcher } from "@/lib/prefetch-cache";
import type { GuestPhotoStatus } from "@/types/database";

// The shape the page consumes: `data.photos` from GET /api/admin/guest-photos,
// each row plus its (best-effort) signed thumbnail URL.
export type GuestPhoto = {
  id: string;
  property_id: string;
  taken_by_name: string | null;
  status: GuestPhotoStatus;
  created_at: string;
  published_at: string | null;
  property: { name: string; nickname: string | null } | null;
  url: string | null;
};

// The exact mount fetch the page used to run inline. Preserves its silent
// behavior: a parse error yields null → an empty list, matching the page's
// `if (data?.photos)` guard (which left state at its initial []).
async function fetchGuestPhotos(): Promise<GuestPhoto[]> {
  const res = await fetch("/api/admin/guest-photos");
  const data = await res.json().catch(() => null);
  return data?.photos ?? [];
}

export const guestPhotosNav = createPrefetcher(() => "guest-photos", fetchGuestPhotos);

export const prefetchGuestPhotos = () => guestPhotosNav.prefetch();
