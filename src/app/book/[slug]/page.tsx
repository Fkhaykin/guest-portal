import { notFound } from "next/navigation";
import { getPropertyDetails } from "@/lib/property-details";
import { reviewsForProperty } from "@/lib/house-aliases";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublishedHousePhotos } from "@/lib/guest-photos";
import { JsonLd } from "@/components/seo/json-ld";
import { SITE_URL, ogMeta } from "@/lib/seo";
import { PropertyPage } from "./property-page";

// "April 2026" → "2026-04" for schema.org datePublished.
const MONTHS: Record<string, string> = {
  January: "01", February: "02", March: "03", April: "04",
  May: "05", June: "06", July: "07", August: "08",
  September: "09", October: "10", November: "11", December: "12",
};
function reviewDateToIso(date: string): string | null {
  const [month, year] = date.split(" ");
  return MONTHS[month] && year ? `${year}-${MONTHS[month]}` : null;
}

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
    // Root layout template appends "| Summit Lakeside Rentals"
    title: property.name,
    description,
    alternates: { canonical: `/book/${slug}` },
    openGraph: ogMeta({
      title: property.name,
      description,
      ...(heroImage ? { images: [{ url: heroImage }] } : {}),
    }),
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

  // Structured data for rich search results. Reviews merge the house's old +
  // new listing names (retired duplicate rows) via reviewsForProperty.
  // Field set follows Google's vacation-rental spec: containsPlace, geo, and
  // identifier are REQUIRED (GSC marks items invalid without them).
  // streetAddress is deliberately omitted — exact addresses stay private.
  const propReviews = reviewsForProperty(property.name);
  const postalCode = property.address?.match(/\b(\d{5})\b/)?.[1];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VacationRental",
    name: property.name,
    url: `${SITE_URL}/book/${slug}`,
    identifier: slug,
    additionalType: "House",
    brand: { "@type": "Brand", name: "Summit Lakeside Rentals" },
    checkinTime: "16:00:00-05:00",
    checkoutTime: "11:00:00-05:00",
    knowsLanguage: "en-US",
    ...(property.description
      ? { description: stripHtml(property.description).slice(0, 500) }
      : {}),
    containsPlace: {
      "@type": "Accommodation",
      additionalType: "EntirePlace",
      ...(property.max_guests
        ? { occupancy: { "@type": "QuantitativeValue", value: property.max_guests } }
        : {}),
      ...(lodgify?.bedrooms ? { numberOfBedrooms: lodgify.bedrooms } : {}),
      ...(lodgify?.bathrooms ? { numberOfBathroomsTotal: lodgify.bathrooms } : {}),
      ...(lodgify?.area
        ? {
            floorSize: {
              "@type": "QuantitativeValue",
              value: lodgify.area,
              unitCode: lodgify.area_unit === "sqm" ? "MTK" : "FTK",
            },
          }
        : {}),
    },
    ...(lodgify
      ? {
          image: lodgify.images.slice(0, 8).map((img) => ({
            "@type": "ImageObject",
            url: img.url,
            ...(img.caption ? { caption: img.caption } : {}),
          })),
          address: {
            "@type": "PostalAddress",
            addressLocality: lodgify.city,
            addressRegion: lodgify.state,
            addressCountry: "US",
            ...(postalCode ? { postalCode } : {}),
          },
          geo: {
            "@type": "GeoCoordinates",
            latitude: lodgify.lat,
            longitude: lodgify.lng,
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
          review: propReviews.slice(0, 10).map((r) => ({
            "@type": "Review",
            author: { "@type": "Person", name: r.name },
            ...(reviewDateToIso(r.date)
              ? { datePublished: reviewDateToIso(r.date) }
              : {}),
            reviewRating: { "@type": "Rating", ratingValue: r.rating },
            reviewBody: r.text.replace(/<br\s*\/?>/gi, " "),
          })),
        }
      : {}),
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Lake Houses", item: `${SITE_URL}/search` },
      { "@type": "ListItem", position: 3, name: property.name },
    ],
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <JsonLd data={breadcrumbLd} />
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
