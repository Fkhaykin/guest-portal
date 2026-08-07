import { NextResponse } from "next/server";
import { getPropertyPhotoGalleries } from "@/lib/property-photos";

/** Photo galleries for all active properties, keyed by property id. */
export async function GET() {
  const photos = await getPropertyPhotoGalleries();

  return NextResponse.json(
    { photos },
    {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    }
  );
}
