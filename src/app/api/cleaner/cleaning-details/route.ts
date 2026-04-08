import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateCleanerSession } from "@/lib/cleaner/auth";
import { getSessionToken } from "@/lib/cleaner/session";
import type { CleaningPhoto } from "@/types/database";

export async function GET(request: Request) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cleaner = await validateCleanerSession(token);
  if (!cleaner) {
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

  const supabase = createAdminClient();

  // Verify registration belongs to a property assigned to this cleaner
  const { data: assignments } = await supabase
    .from("cleaner_property")
    .select("property_id")
    .eq("cleaner_id", cleaner.id);

  if (!assignments || assignments.length === 0) {
    return NextResponse.json({ error: "No assigned properties" }, { status: 403 });
  }

  const propertyIds = assignments.map((a) => a.property_id);

  const { data: reg } = await supabase
    .from("registration")
    .select("id, property_id")
    .eq("id", registrationId)
    .in("property_id", propertyIds)
    .single();

  if (!reg) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 });
  }

  const { data: status } = await supabase
    .from("cleaning_status")
    .select("*")
    .eq("registration_id", registrationId)
    .single();

  if (!status) {
    return NextResponse.json({ error: "No cleaning status found" }, { status: 404 });
  }

  // Generate signed URLs for all photos
  const photos = (status.photos as CleaningPhoto[]) || [];
  const photosWithUrls = await Promise.all(
    photos.map(async (photo) => {
      const { data } = await supabase.storage
        .from("cleaning-photos")
        .createSignedUrl(photo.path, 3600);
      return { ...photo, url: data?.signedUrl ?? null };
    })
  );

  return NextResponse.json({
    ...status,
    photos: photosWithUrls,
  });
}
