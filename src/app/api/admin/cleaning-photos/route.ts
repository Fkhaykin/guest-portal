import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CleaningPhoto } from "@/types/database";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const registrationId = searchParams.get("registration_id");

  if (!registrationId) {
    return NextResponse.json(
      { error: "registration_id is required" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Verify the registration belongs to a property owned by this host
  const { data: host } = await admin
    .from("host")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (!host) {
    return NextResponse.json({ error: "Not a host" }, { status: 403 });
  }

  const { data: reg } = await admin
    .from("registration")
    .select("id, property_id")
    .eq("id", registrationId)
    .single();

  if (!reg) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 });
  }

  // Verify the property belongs to this host
  const { data: prop } = await admin
    .from("property")
    .select("id")
    .eq("id", reg.property_id)
    .eq("host_id", host.id)
    .single();

  if (!prop) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 });
  }

  const { data: status } = await admin
    .from("cleaning_status")
    .select("*")
    .eq("registration_id", registrationId)
    .single();

  if (!status) {
    return NextResponse.json({ cleaning: null });
  }

  // Generate signed URLs for all photos
  const photos = (status.photos as CleaningPhoto[]) || [];
  const photosWithUrls = await Promise.all(
    photos.map(async (photo) => {
      const { data } = await admin.storage
        .from("cleaning-photos")
        .createSignedUrl(photo.path, 3600);
      return { ...photo, url: data?.signedUrl ?? null };
    })
  );

  return NextResponse.json({
    cleaning: {
      is_cleaned: status.is_cleaned,
      cleaned_at: status.cleaned_at,
      photos: photosWithUrls,
      notes: status.notes,
      fulfilled_upsells: status.fulfilled_upsells,
    },
  });
}
