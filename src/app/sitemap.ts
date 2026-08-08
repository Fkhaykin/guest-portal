import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/seo";

// Refresh the property list hourly so activating/deactivating a listing in the
// admin doesn't require a redeploy to be reflected here.
export const revalidate = 3600;

const MARKETING_PATHS = [
  "/",
  "/search",
  "/things-to-do",
  "/east-stroudsburg-restaurants",
  "/penn-estates",
  "/blue-mountain-lake",
  "/poconos-fall-getaways",
  "/faq",
  "/why-summit",
  "/management-services",
  "/contact",
  "/rental-policies",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = MARKETING_PATHS.map((path) => ({
    url: `${SITE_URL}${path}`,
  }));

  const supabase = createAdminClient();
  const { data: properties } = await supabase
    .from("property")
    .select("slug, updated_at")
    .eq("is_active", true);

  for (const property of properties ?? []) {
    entries.push({
      url: `${SITE_URL}/book/${property.slug}`,
      lastModified: property.updated_at ?? undefined,
    });
  }

  return entries;
}
