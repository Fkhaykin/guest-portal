// Canonical origin for all SEO surfaces (sitemap, canonicals, JSON-LD, llms.txt).
// Deliberately NOT NEXT_PUBLIC_APP_URL — that is the guest-portal base used for
// QR codes, Stripe return URLs, and transactional links.
export const SITE_URL = "https://www.summitlakeside.com";

// Hosts allowed to be indexed. Everything else (guest./admin./manager./kiosk.
// subdomains, *.vercel.app previews and the raw production alias) gets an
// X-Robots-Tag: noindex header from the proxy.
const INDEXABLE_HOSTS = new Set(["www.summitlakeside.com", "summitlakeside.com"]);

export function isIndexableHost(hostHeader: string | null): boolean {
  if (!hostHeader) return false;
  return INDEXABLE_HOSTS.has(hostHeader.split(":")[0].toLowerCase());
}

export const DEFAULT_OG_IMAGE =
  "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-355872/airbnb/46-lake-dock.jpg";

/** Full openGraph object for a page. Next's metadata merge is shallow — a
 *  page-level `openGraph` replaces the layout's entirely — so every page that
 *  customizes OG must go through this to keep siteName + a default image. */
export function ogMeta({
  title,
  description,
  images,
}: {
  title: string;
  description: string;
  images?: { url: string; width?: number; height?: number }[];
}) {
  return {
    siteName: "Summit Lakeside Rentals",
    type: "website" as const,
    locale: "en_US",
    title,
    description,
    images: images ?? [{ url: DEFAULT_OG_IMAGE, width: 1920, height: 1280 }],
  };
}
