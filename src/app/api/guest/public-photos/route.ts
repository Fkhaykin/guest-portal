import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const propertyId = searchParams.get("property_id");

  const supabase = createAdminClient();

  let query = supabase
    .from("guest_photo")
    .select("id, property_id, file_path, caption, guest_name, created_at")
    .eq("approved", true)
    .order("created_at", { ascending: false })
    .limit(20);

  if (propertyId) {
    query = query.eq("property_id", propertyId);
  }

  const { data: photos, error } = await query;

  if (error) {
    return NextResponse.json({ error: "Failed to load photos" }, { status: 500 });
  }

  // Get property names for display
  const propertyIds = [...new Set((photos || []).map((p) => p.property_id))];
  const { data: properties } = await supabase
    .from("property")
    .select("id, name")
    .in("id", propertyIds);

  const propertyMap = new Map(
    (properties || []).map((p) => [p.id, p.name])
  );

  // Generate signed URLs
  const photosWithUrls = await Promise.all(
    (photos || []).map(async (photo) => {
      const { data } = await supabase.storage
        .from("guest-photos")
        .createSignedUrl(photo.file_path, 3600);
      return {
        id: photo.id,
        url: data?.signedUrl || null,
        caption: photo.caption,
        guest_name: photo.guest_name,
        property_name: propertyMap.get(photo.property_id) || null,
        created_at: photo.created_at,
      };
    })
  );

  return NextResponse.json({
    photos: photosWithUrls.filter((p) => p.url),
  });
}
