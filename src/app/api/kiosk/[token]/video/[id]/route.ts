import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveKioskProperty } from "@/lib/kiosk";

/** Fresh signed playback URL, minted per view — a kiosk stays open for days,
 *  so URLs signed at page-load time would expire. Unlike the portal player
 *  page, the video must belong to this kiosk's property. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string; id: string }> }
) {
  const { token, id } = await params;
  const admin = createAdminClient();

  const property = await resolveKioskProperty(admin, token);
  if (!property) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: video } = await admin
    .from("video")
    .select("id, title, description, storage_path")
    .eq("id", id)
    .eq("property_id", property.id)
    .maybeSingle();
  if (!video) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: signed, error } = await admin.storage
    .from("videos")
    .createSignedUrl(video.storage_path, 3600);
  if (error || !signed) {
    return NextResponse.json({ error: "Video unavailable" }, { status: 502 });
  }

  return NextResponse.json(
    { url: signed.signedUrl, title: video.title, description: video.description },
    { headers: { "Cache-Control": "no-store" } }
  );
}
