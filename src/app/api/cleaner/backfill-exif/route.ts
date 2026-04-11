import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import exifReader from "exif-reader";
import type { CleaningPhoto, CleaningPhotoExif } from "@/types/database";

function extractExif(buffer: Buffer): CleaningPhotoExif | undefined {
  try {
    const data = exifReader(buffer);
    if (!data) return undefined;

    const dt =
      data.Photo?.DateTimeOriginal ??
      data.Photo?.DateTimeDigitized ??
      data.Image?.DateTime;
    const gpsInfo = data.GPSInfo;
    const make = data.Image?.Make;
    const model = data.Image?.Model;
    const width = data.Photo?.PixelXDimension ?? data.Image?.ImageWidth;
    const height = data.Photo?.PixelYDimension ?? data.Image?.ImageLength;

    const exif: CleaningPhotoExif = {};
    if (dt) exif.taken_at = dt instanceof Date ? dt.toISOString() : String(dt);
    if (gpsInfo?.GPSLatitude && gpsInfo?.GPSLongitude) {
      const toDecimal = (dms: number[]) =>
        dms[0] + dms[1] / 60 + dms[2] / 3600;
      let lat = toDecimal(gpsInfo.GPSLatitude);
      let lon = toDecimal(gpsInfo.GPSLongitude);
      if (gpsInfo.GPSLatitudeRef === "S") lat = -lat;
      if (gpsInfo.GPSLongitudeRef === "W") lon = -lon;
      exif.latitude = lat;
      exif.longitude = lon;
    }
    if (make || model) {
      exif.camera = [make, model].filter(Boolean).join(" ");
    }
    if (width) exif.width = width;
    if (height) exif.height = height;

    return Object.keys(exif).length > 0 ? exif : undefined;
  } catch {
    return undefined;
  }
}

export async function POST(request: Request) {
  // Simple secret check to prevent accidental invocation
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  if (secret !== process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(-8)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Fetch all cleaning_status rows that have photos
  const { data: rows, error } = await supabase
    .from("cleaning_status")
    .select("registration_id, photos")
    .not("photos", "eq", "[]");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let totalPhotos = 0;
  let enriched = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const row of rows || []) {
    const photos = (row.photos as CleaningPhoto[]) || [];
    let updated = false;

    for (let i = 0; i < photos.length; i++) {
      totalPhotos++;
      const photo = photos[i];

      // Skip if already has exif
      if (photo.exif) {
        skipped++;
        continue;
      }

      try {
        const { data: fileData, error: dlError } = await supabase.storage
          .from("cleaning-photos")
          .download(photo.path);

        if (dlError || !fileData) {
          failed++;
          errors.push(`${photo.path}: download failed`);
          continue;
        }

        const buffer = Buffer.from(await fileData.arrayBuffer());
        const exif = extractExif(buffer);

        if (exif) {
          photos[i] = { ...photo, exif };
          enriched++;
          updated = true;
        } else {
          skipped++;
        }
      } catch (err) {
        failed++;
        errors.push(`${photo.path}: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }

    if (updated) {
      const { error: updateError } = await supabase
        .from("cleaning_status")
        .update({ photos })
        .eq("registration_id", row.registration_id);

      if (updateError) {
        errors.push(`update ${row.registration_id}: ${updateError.message}`);
      }
    }
  }

  return NextResponse.json({
    total_photos: totalPhotos,
    enriched,
    skipped,
    failed,
    errors: errors.slice(0, 20),
  });
}
