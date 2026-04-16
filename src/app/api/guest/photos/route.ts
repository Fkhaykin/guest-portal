import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyGuestToken } from "@/lib/guest-token";

export async function POST(request: Request) {
  const body = await request.json();
  const { registration_id } = body;

  if (!registration_id) {
    return NextResponse.json({ error: "registration_id is required" }, { status: 400 });
  }

  const token = request.headers.get("x-guest-token") || "";
  if (!verifyGuestToken(registration_id, token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: photos, error } = await supabase
    .from("guest_photo")
    .select("id, file_path, caption, approved, created_at")
    .eq("registration_id", registration_id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to load photos" }, { status: 500 });
  }

  // Generate signed URLs
  const photosWithUrls = await Promise.all(
    (photos || []).map(async (photo) => {
      const { data } = await supabase.storage
        .from("guest-photos")
        .createSignedUrl(photo.file_path, 3600);
      return {
        ...photo,
        url: data?.signedUrl || null,
      };
    })
  );

  // Check reward status
  const { data: reg } = await supabase
    .from("registration")
    .select("photo_reward_claimed")
    .eq("id", registration_id)
    .single();

  return NextResponse.json({
    photos: photosWithUrls,
    photo_count: photos?.length || 0,
    reward_claimed: reg?.photo_reward_claimed || false,
  });
}

export async function DELETE(request: Request) {
  const body = await request.json();
  const { registration_id, photo_id } = body;

  if (!registration_id || !photo_id) {
    return NextResponse.json({ error: "registration_id and photo_id are required" }, { status: 400 });
  }

  const token = request.headers.get("x-guest-token") || "";
  if (!verifyGuestToken(registration_id, token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Verify photo belongs to this registration
  const { data: photo } = await supabase
    .from("guest_photo")
    .select("id, file_path")
    .eq("id", photo_id)
    .eq("registration_id", registration_id)
    .single();

  if (!photo) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }

  // Delete from storage
  await supabase.storage.from("guest-photos").remove([photo.file_path]);

  // Delete from database
  await supabase.from("guest_photo").delete().eq("id", photo_id);

  return NextResponse.json({ ok: true });
}
