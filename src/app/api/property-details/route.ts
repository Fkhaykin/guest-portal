import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const LODGIFY_API_KEY = process.env.LODGIFY_API_KEY;

async function lodgifyFetch<T>(path: string): Promise<T> {
  const res = await fetch(`https://api.lodgify.com${path}`, {
    headers: {
      "X-ApiKey": LODGIFY_API_KEY!,
      Accept: "application/json",
    },
    next: { revalidate: 3600 }, // cache for 1 hour
  });
  if (!res.ok) throw new Error(`Lodgify ${res.status}`);
  return res.json() as Promise<T>;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");

  if (!slug) {
    return NextResponse.json({ error: "slug is required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: property } = await supabase
    .from("property")
    .select("id, name, slug, address, description, cover_image_url, max_guests, lodgify_property_id")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (!property || !property.lodgify_property_id) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  try {
    // Fetch property details and room details in parallel
    const [propData, roomsData] = await Promise.all([
      lodgifyFetch<{
        id: number;
        name: string;
        description: string | null;
        min_price: number | null;
        max_price: number | null;
        original_min_price: number | null;
        currency_code: string;
        rating: number;
        latitude: number;
        longitude: number;
        city: string | null;
        state: string | null;
      }>(`/v2/properties/${property.lodgify_property_id}`),
      lodgifyFetch<
        {
          id: number;
          name: string;
          description: string | null;
          max_people: number;
          bedrooms: number;
          bathrooms: number;
          area: number | null;
          area_unit: string | null;
          pets_allowed: boolean;
          has_parking: boolean;
          has_wifi: boolean;
          images: { url: string; text: string }[];
          amenities: Record<
            string,
            { name: string; text: string; prefix: string | null }[]
          >;
        }[]
      >(`/v2/properties/${property.lodgify_property_id}/rooms`),
    ]);

    const room = roomsData[0];

    return NextResponse.json({
      property: {
        id: property.id,
        name: property.name,
        slug: property.slug,
        address: property.address,
        description: propData.description || property.description,
        cover_image_url: property.cover_image_url,
        max_guests: property.max_guests ?? room?.max_people ?? null,
        lodgify_property_id: property.lodgify_property_id,
      },
      lodgify: {
        min_price: propData.original_min_price || propData.min_price,
        max_price: propData.max_price,
        currency: propData.currency_code,
        rating: propData.rating,
        lat: propData.latitude,
        lng: propData.longitude,
        city: propData.city,
        state: propData.state,
        bedrooms: room?.bedrooms || 0,
        bathrooms: room?.bathrooms || 0,
        area: room?.area,
        area_unit: room?.area_unit,
        pets_allowed: room?.pets_allowed || false,
        has_parking: room?.has_parking || false,
        has_wifi: room?.has_wifi || false,
        images: (room?.images || []).map((img) => ({
          url: img.url.startsWith("//") ? `https:${img.url}` : img.url,
        })),
        amenities: room?.amenities || {},
      },
    });
  } catch {
    // Fallback to just DB data if Lodgify is down
    return NextResponse.json({
      property: {
        id: property.id,
        name: property.name,
        slug: property.slug,
        address: property.address,
        description: property.description,
        cover_image_url: property.cover_image_url,
        max_guests: property.max_guests,
        lodgify_property_id: property.lodgify_property_id,
      },
      lodgify: null,
    });
  }
}
