import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPropertyPhotoGalleries } from "@/lib/property-photos";
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
    <HomeV2Page initialProperties={properties ?? []} initialPhotos={photos} />
  );
}
