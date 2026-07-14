import { notFound } from "next/navigation";
import { getPropertyDetails } from "@/lib/property-details";
import { REVIEWS } from "@/lib/reviews-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublishedHousePhotos } from "@/lib/guest-photos";
import { PropertyPage } from "./property-page";

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const details = await getPropertyDetails(slug);

  if (!details) return { title: "Property Not Found" };

  const { property, lodgify } = details;
  const description = property.description
    ? stripHtml(property.description).slice(0, 160)
    : `Book your stay at ${property.name} in the Pocono Mountains.`;
  const heroImage = lodgify?.images[0]?.url ?? property.cover_image_url;

  return {
    title: `${property.name} | Summit Lakeside Rentals`,
    description,
    openGraph: {
      title: property.name,
      description,
      ...(heroImage ? { images: [{ url: heroImage }] } : {}),
    },
  };
}

export default async function BookPropertyPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ check_in?: string; check_out?: string; guests?: string; pets?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;

  const details = await getPropertyDetails(slug);
  if (!details) notFound();

  const { property, lodgify } = details;

  // Published guest photos for this house (grouped across nickname siblings).
  const admin = createAdminClient();
  const { data: propRow } = await admin
    .from("property")
    .select("nickname")
    .eq("id", property.id)
    .maybeSingle();
  const guestPhotos = await getPublishedHousePhotos(admin, {
    propertyId: property.id,
    nickname: propRow?.nickname ?? null,
  });

  // Structured data for rich search results
  const propReviews = REVIEWS.filter((r) => r.property === property.name);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VacationRental",
    name: property.name,
    ...(property.description
      ? { description: stripHtml(property.description).slice(0, 500) }
      : {}),
    ...(lodgify
      ? {
          image: lodgify.images.slice(0, 8).map((img) => img.url),
          address: {
            "@type": "PostalAddress",
            addressLocality: lodgify.city,
            addressRegion: lodgify.state,
            addressCountry: "US",
          },
        }
      : {}),
    ...(propReviews.length
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: (
              propReviews.reduce((sum, r) => sum + r.rating, 0) / propReviews.length
            ).toFixed(2),
            reviewCount: propReviews.length,
          },
        }
      : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PropertyPage
        details={details}
        checkIn={query.check_in}
        checkOut={query.check_out}
        guests={query.guests}
        pets={query.pets}
        guestPhotos={guestPhotos}
      />
    </>
  );
}
