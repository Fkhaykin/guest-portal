import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// Served identically on every hostname; non-canonical hosts are deindexed via
// the X-Robots-Tag header set in src/proxy.ts rather than a per-host Disallow
// (a Disallow would stop Google from ever seeing the noindex). /p is likewise
// left crawlable on purpose — its pages carry noindex metadata that Google has
// to fetch to act on.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/cleaner",
        "/kiosk",
        "/pay",
        "/auth",
        "/checkin",
        "/api/",
        "/q/",
        "/book/*/checkout",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
