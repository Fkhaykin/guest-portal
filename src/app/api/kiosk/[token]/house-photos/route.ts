import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveKioskProperty } from "@/lib/kiosk";
import { getPublishedHousePhotos } from "@/lib/guest-photos";

// Published house-album photos for the kiosk "House Album" screen. Public within
// the kiosk (no guest token) — these are already admin-approved for display.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const admin = createAdminClient();

  const property = await resolveKioskProperty(admin, token);
  if (!property) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const photos = await getPublishedHousePhotos(admin, {
    propertyId: property.id,
    nickname: property.nickname,
  });

  return NextResponse.json({ photos }, { headers: { "Cache-Control": "no-store" } });
}
