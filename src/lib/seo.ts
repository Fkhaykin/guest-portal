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
