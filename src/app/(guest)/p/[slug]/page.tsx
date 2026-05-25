import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { QuickLinks } from "./quick-links";
import { InstagramFeedSection } from "@/components/guest/instagram-feed";
import { ReviewsCarousel } from "@/components/guest/reviews-carousel";

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

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">
          Welcome!
        </h2>
        {property.description && (
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            {property.description}
          </p>
        )}
      </div>

      <QuickLinks slug={slug} />

      <ReviewsCarousel />

      <InstagramFeedSection />
    </div>
  );
}
