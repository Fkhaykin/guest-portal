// Shared loader + prefetch cache for the Aircover / Potential Claims landing load.
//
// `/admin/aircover-claims` is client-rendered: on mount it fetches the claim
// list (`loadClaims`) before it can paint. This module extracts that fetch so a
// sidebar hover can warm it before the click, letting the page read an
// already-resolved list instantly.
//
// Per-claim damage-photo signed URLs load later inside a child component and are
// NOT part of this landing load — they stay on the page.

import { createPrefetcher } from "@/lib/prefetch-cache";
import type { Claim } from "@/app/(admin)/admin/aircover-claims/page";

// GET /api/admin/aircover-claims → { claims: Claim[] }.
// Returns the raw `claims` field (possibly undefined) so the page keeps its
// original "only replace state when the payload is present" guard.
async function fetchClaims(): Promise<Claim[] | undefined> {
  const res = await fetch("/api/admin/aircover-claims");
  const data = await res.json();
  return data.claims as Claim[] | undefined;
}

export const aircoverNav = createPrefetcher(() => "aircover-claims", fetchClaims);

export const prefetchAircover = () => aircoverNav.prefetch();
