// Shared loader + prefetch cache for the Pricing Lab landing load.
//
// `/admin/pricing` is client-rendered: on mount it fetches the house/config
// list before it can paint anything. This module extracts that ONE independent
// landing fetch so a sidebar hover can warm it before the click, letting the
// page read an already-resolved list instantly.
//
// Only the config LIST is prefetched here. The per-house payload (`loadHouse`
// on the page) depends on the user's current selection and is intentionally
// left on the page — it is not a mount-time independent load.

import { createPrefetcher } from "@/lib/prefetch-cache";
import type { PricingConfig } from "@/app/(admin)/admin/pricing/types";

// GET /api/admin/pricing-lab (no nickname) → { configs: PricingConfig[] }.
// Mirrors the fetch `loadConfigs` did inline, including its exact error text so
// the page's error UI is unchanged.
async function fetchPricingConfigs(): Promise<PricingConfig[]> {
  const res = await fetch("/api/admin/pricing-lab");
  if (!res.ok) throw new Error("Failed to load houses");
  const json = await res.json();
  return (json.configs ?? []) as PricingConfig[];
}

export const pricingNav = createPrefetcher(() => "pricing-configs", fetchPricingConfigs);

export const prefetchPricing = () => pricingNav.prefetch();
