// Sidebar nav → data prefetch registry.
//
// Next's <Link> already prefetches each admin route's JS/RSC bundle on hover.
// But these landing pages are client components that fetch their data on mount,
// so the bundle being warm doesn't help — you still wait for the query after
// the click. Each entry here warms that page's DATA (via its nav module's
// createPrefetcher) so hovering the sidebar link makes the click feel instant.
//
// Only client pages with a real mount-time fetch are listed. Server-component
// pages (Dashboard, Campaigns, Invoices, Settings) fetch on the server and are
// already covered by the <Link> RSC prefetch.

import { prefetchReservationsList } from "./reservations-list";
import { prefetchDeliveries } from "./deliveries";
import { prefetchMessages } from "./messages";
import { prefetchPricing } from "./pricing";
import { prefetchAircover } from "./aircover";
import { prefetchGuestPhotos } from "./guest-photos";

const ROUTE_PREFETCHERS: Record<string, () => void> = {
  "/admin/reservations": prefetchReservationsList,
  "/admin/deliveries": prefetchDeliveries,
  "/admin/messages": prefetchMessages,
  "/admin/pricing": prefetchPricing,
  "/admin/aircover-claims": prefetchAircover,
  "/admin/guest-photos": prefetchGuestPhotos,
};

// Warm a route's data if we have a prefetcher for it; a no-op otherwise, so the
// sidebar can call it for every link without caring which are covered.
export function prefetchAdminRoute(href: string): void {
  ROUTE_PREFETCHERS[href]?.();
}
