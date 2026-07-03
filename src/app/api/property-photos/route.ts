import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAirbnbPhotos } from "@/lib/airbnb-photos";

const LODGIFY_API_KEY = process.env.LODGIFY_API_KEY;

// 8 carousel slides + 1 backdrop for the "view more" overlay
const MAX_PHOTOS = 9;

async function lodgifyRoomImages(propertyId: number): Promise<string[]> {
  try {
    const res = await fetch(
      `https://api.lodgify.com/v2/properties/${propertyId}/rooms`,
      {
        headers: { "X-ApiKey": LODGIFY_API_KEY!, Accept: "application/json" },
        next: { revalidate: 3600 },
      }
    );
    if (!res.ok) return [];
    const rooms = (await res.json()) as { images?: { url: string }[] }[];
    return (rooms[0]?.images || []).map((img) =>
      img.url.startsWith("//") ? `https:${img.url}` : img.url
    );
  } catch {
    return [];
  }
}

/** Photo galleries for all active properties, keyed by property id.
 *  Curated Airbnb photos when we have them, Lodgify room images otherwise. */
export async function GET() {
  const supabase = createAdminClient();
  const { data: properties } = await supabase
    .from("property")
    .select("id, name, lodgify_property_id")
    .eq("is_active", true);

  const photos: Record<string, string[]> = {};
  await Promise.all(
    (properties || []).map(async (p) => {
      const urls =
        getAirbnbPhotos(p.name) ??
        (p.lodgify_property_id
          ? await lodgifyRoomImages(p.lodgify_property_id)
          : []);
      if (urls.length) photos[p.id] = urls.slice(0, MAX_PHOTOS);
    })
  );

  return NextResponse.json(
    { photos },
    {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    }
  );
}
