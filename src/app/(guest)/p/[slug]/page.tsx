import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { QuickLinks } from "./quick-links";
import { PropertyHero } from "@/components/guest/property-hero";
import { SectionHeader } from "@/components/ui/section-header";
import { InstagramFeedSection } from "@/components/guest/instagram-feed";
import { ReviewsCarousel } from "@/components/guest/reviews-carousel";
import { GuestPhotoAlbum } from "@/components/guest/guest-photo-album";
import { getPublishedHousePhotos } from "@/lib/guest-photos";

export default async function PropertyHomePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: property } = await supabase
    .from("property")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!property) notFound();

  const housePhotos = await getPublishedHousePhotos(createAdminClient(), {
    propertyId: property.id,
    nickname: property.nickname,
  });

  // The house's own cover, or the best guest photo of it if the listing has
  // no cover set — a lakefront portal should never open on a blank panel.
  const heroImage = property.cover_image_url ?? housePhotos[0]?.url ?? null;

  return (
    <div className="space-y-10 stagger-children">
      <PropertyHero
        name={property.name}
        description={property.description}
        imageUrl={heroImage}
      />

      <section className="space-y-4">
        <SectionHeader eyebrow="Your stay" title="Everything in one place" />
        <QuickLinks slug={slug} />
      </section>

      {housePhotos.length > 0 && <GuestPhotoAlbum photos={housePhotos} />}

      <ReviewsCarousel />

      <InstagramFeedSection />
    </div>
  );
}
