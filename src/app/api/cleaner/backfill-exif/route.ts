import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import exifr from "exifr";
import type { CleaningPhoto, CleaningPhotoExif } from "@/types/database";

async function extractExif(buffer: Buffer): Promise<CleaningPhotoExif | undefined> {
  try {
    const data = await exifr.parse(buffer, {
      gps: true,
      tiff: true,
      exif: true,
      pick: [
        "DateTimeOriginal", "DateTimeDigitized", "ModifyDate",
        "Make", "Model",
        "ExifImageWidth", "ExifImageHeight", "ImageWidth", "ImageHeight",
        "latitude", "longitude",
      ],
    });
    if (!data) return undefined;

    const exif: CleaningPhotoExif = {};

    const dt = data.DateTimeOriginal ?? data.DateTimeDigitized ?? data.ModifyDate;
    if (dt) exif.taken_at = dt instanceof Date ? dt.toISOString() : String(dt);

    if (data.latitude != null && data.longitude != null) {
      exif.latitude = data.latitude;
      exif.longitude = data.longitude;
    }

    const make = data.Make;
    const model = data.Model;
    if (make || model) exif.camera = [make, model].filter(Boolean).join(" ");

    const width = data.ExifImageWidth ?? data.ImageWidth;
    const height = data.ExifImageHeight ?? data.ImageHeight;
    if (width) exif.width = width;
    if (height) exif.height = height;

    return Object.keys(exif).length > 0 ? exif : undefined;
  } catch {
    return undefined;
  }
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  if (secret !== process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(-8)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

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
        const exif = await extractExif(buffer);

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
