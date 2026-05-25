import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function getHost() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: host } = await admin
    .from("host")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  return host;
}

export async function GET(request: Request) {
  const host = await getHost();
  if (!host) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const registrationId = new URL(request.url).searchParams.get("registration_id");

  // Get all photos for this host's properties
  const { data: properties } = await supabase
    .from("property")
    .select("id, name")
    .eq("host_id", host.id);

  if (!properties?.length) {
    return NextResponse.json({ photos: [] });
  }

  const propertyIds = properties.map((p) => p.id);
  const propertyMap = new Map(properties.map((p) => [p.id, p.name]));

  let query = supabase
    .from("guest_photo")
    .select("*")
    .in("property_id", propertyIds)
    .order("created_at", { ascending: false });

  if (registrationId) {
    query = query.eq("registration_id", registrationId);
  }

  const { data: photos } = await query;

  const photosWithUrls = await Promise.all(
    (photos || []).map(async (photo) => {
      const { data } = await supabase.storage
        .from("guest-photos")
        .createSignedUrl(photo.file_path, 3600);
      return {
        ...photo,
        url: data?.signedUrl || null,
        property_name: propertyMap.get(photo.property_id) || null,
      };
    })
  );

  return NextResponse.json({ photos: photosWithUrls });
}

export async function PATCH(request: Request) {
  const host = await getHost();
  if (!host) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { photo_id, action } = body; // action: "approve" | "reject"

  if (!photo_id || !action) {
    return NextResponse.json({ error: "photo_id and action are required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Verify photo belongs to host's property
  const { data: photo } = await supabase
    .from("guest_photo")
    .select("id, file_path, property_id")
    .eq("id", photo_id)
    .single();

  if (!photo) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }

  const { data: property } = await supabase
    .from("property")
    .select("id")
    .eq("id", photo.property_id)
    .eq("host_id", host.id)
    .single();

  if (!property) {
    return NextResponse.json({ error: "Not authorized for this property" }, { status: 403 });
  }

  if (action === "approve") {
    await supabase
      .from("guest_photo")
      .update({ approved: true })
      .eq("id", photo_id);
  } else if (action === "reject") {
    await supabase.storage.from("guest-photos").remove([photo.file_path]);
    await supabase.from("guest_photo").delete().eq("id", photo_id);
  }

  return NextResponse.json({ ok: true });
}
