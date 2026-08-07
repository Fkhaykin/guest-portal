import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPropertyPhotoGalleries } from "@/lib/property-photos";
import { REVIEW_STATS } from "@/lib/reviews-data";
import { JsonLd } from "@/components/seo/json-ld";
import { SITE_URL } from "@/lib/seo";
import HomeV2Page from "./home-client";

// Property list + galleries refresh hourly without a redeploy.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: { absolute: "Poconos Lakefront Vacation Rentals | Summit Lakeside" },
  description:
    "Five lakefront homes in the Poconos with hot tubs, saunas, game rooms, boats & fire pits. Pet-friendly, about 90 minutes from NYC. Book direct and save.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Poconos Lakefront Vacation Rentals | Summit Lakeside",
    description:
      "Five lakefront homes in the Poconos with hot tubs, saunas, game rooms, boats & fire pits. Book direct and save.",
  },
};

export default async function Page() {
  const supabase = createAdminClient();
  const [{ data: properties }, photos] = await Promise.all([
    supabase
      .from("property")
      .select("id, name, slug, address, description, cover_image_url, max_guests")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    getPropertyPhotoGalleries(),
  ]);

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "LodgingBusiness",
          name: "Summit Lakeside Rentals",
          url: SITE_URL,
          image:
            "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-355872/airbnb/46-lake-dock.jpg",
          address: {
            "@type": "PostalAddress",
            addressLocality: "East Stroudsburg",
            addressRegion: "PA",
            postalCode: "18301",
            addressCountry: "US",
          },
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: REVIEW_STATS.averageRating,
            reviewCount: REVIEW_STATS.totalCount,
          },
        }}
      />
      <HomeV2Page initialProperties={properties ?? []} initialPhotos={photos} />
    </>
  );
}
