import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import exifr from "exifr";
import type { CleaningPhoto, CleaningPhotoExif } from "@/types/database";

async function extractExifFromUrl(url: string): Promise<CleaningPhotoExif | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());

    const data = await exifr.parse(buf, {
      gps: true,
      tiff: true,
      exif: true,
      pick: [
        "DateTimeOriginal",
        "DateTimeDigitized",
        "ModifyDate",
        "Make",
        "Model",
        "ExifImageWidth",
        "ExifImageHeight",
        "ImageWidth",
        "ImageHeight",
        "latitude",
        "longitude",
        "GPSAltitude",
        "LensModel",
        "LensMake",
        "ISO",
        "ISOSpeedRatings",
        "FNumber",
        "ExposureTime",
        "FocalLength",
        "FocalLengthIn35mmFormat",
        "Flash",
        "Orientation",
        "Software",
        "ColorSpace",
        "WhiteBalance",
        "ExposureMode",
        "SceneCaptureType",
      ],
    });

    if (!data) return null;

    const result: CleaningPhotoExif = {};

    const dt = data.DateTimeOriginal ?? data.DateTimeDigitized ?? data.ModifyDate;
    if (dt) result.taken_at = dt instanceof Date ? dt.toISOString() : String(dt);

    if (data.latitude != null && data.longitude != null) {
      result.latitude = data.latitude;
      result.longitude = data.longitude;
    }
    if (data.GPSAltitude != null) result.altitude = data.GPSAltitude;

    const make = data.Make;
    const model = data.Model;
    if (make || model) result.camera = [make, model].filter(Boolean).join(" ");

    if (data.LensModel || data.LensMake)
      result.lens = [data.LensMake, data.LensModel].filter(Boolean).join(" ");

    const w = data.ExifImageWidth ?? data.ImageWidth;
    const h = data.ExifImageHeight ?? data.ImageHeight;
    if (w) result.width = w;
    if (h) result.height = h;

    const iso = data.ISO ?? data.ISOSpeedRatings;
    if (iso != null) result.iso = iso;
    if (data.FNumber != null) result.aperture = data.FNumber;
    if (data.ExposureTime != null) {
      result.shutter_speed =
        data.ExposureTime < 1
          ? `1/${Math.round(1 / data.ExposureTime)}`
          : `${data.ExposureTime}`;
    }
    if (data.FocalLength)
      result.focal_length = `${data.FocalLength}mm${data.FocalLengthIn35mmFormat ? ` (${data.FocalLengthIn35mmFormat}mm eq)` : ""}`;
    if (data.Flash != null)
      result.flash =
        typeof data.Flash === "object" ? JSON.stringify(data.Flash) : String(data.Flash);
    if (data.Orientation) result.orientation = data.Orientation;
    if (data.Software) result.software = data.Software;
    if (data.ColorSpace != null) result.color_space = String(data.ColorSpace);
    if (data.WhiteBalance != null)
      result.white_balance = data.WhiteBalance === 0 ? "Auto" : "Manual";
    if (data.ExposureMode != null)
      result.exposure_mode =
        data.ExposureMode === 0 ? "Auto" : data.ExposureMode === 1 ? "Manual" : String(data.ExposureMode);
    if (data.SceneCaptureType != null) {
      const scenes = ["Standard", "Landscape", "Portrait", "Night"];
      result.scene_type = scenes[data.SceneCaptureType] ?? String(data.SceneCaptureType);
    }

    result.source = Object.keys(result).length > 0 ? "exif" : "browser";

    // Infer file_type from content-type
    const ct = res.headers.get("content-type");
    if (ct) result.file_type = ct.split(";")[0].trim();

    // file_size from Content-Length if available
    const cl = res.headers.get("content-length");
    if (cl) result.file_size = parseInt(cl, 10);
    else result.file_size = buf.byteLength;

    return Object.keys(result).length > 1 ? result : null; // at least something beyond source
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: host } = await admin
    .from("host")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (!host) {
    return NextResponse.json({ error: "Not a host" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const registrationId = searchParams.get("registration_id");

  // Fetch cleaning_status rows for properties owned by this host
  let query = admin
    .from("cleaning_status")
    .select("id, registration_id, photos")
    .not("photos", "is", null);

  if (registrationId) {
    query = query.eq("registration_id", registrationId);
  } else {
    // Scope to host's properties via registration → property
    const { data: props } = await admin
      .from("property")
      .select("id")
      .eq("host_id", host.id);
    const propIds = (props ?? []).map((p) => p.id);
    if (propIds.length === 0) {
      return NextResponse.json({ updated: 0, skipped: 0, rows: [] });
    }
    const { data: regs } = await admin
      .from("registration")
      .select("id")
      .in("property_id", propIds);
    const regIds = (regs ?? []).map((r) => r.id);
    if (regIds.length === 0) {
      return NextResponse.json({ updated: 0, skipped: 0, rows: [] });
    }
    query = query.in("registration_id", regIds);
  }

  const { data: rows, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let totalUpdated = 0;
  let totalSkipped = 0;
  const summary: { registration_id: string; updated: number; skipped: number }[] = [];

  for (const row of rows ?? []) {
    const photos = (row.photos as CleaningPhoto[]) ?? [];
    const needsBackfill = photos.some((p) => !p.exif);
    if (!needsBackfill) {
      summary.push({ registration_id: row.registration_id, updated: 0, skipped: photos.length });
      totalSkipped += photos.length;
      continue;
    }

    // Generate signed URLs for photos missing exif
    const updated: CleaningPhoto[] = [];
    let rowUpdated = 0;
    let rowSkipped = 0;

    for (const photo of photos) {
      if (photo.exif) {
        updated.push(photo);
        rowSkipped++;
        continue;
      }

      const { data: signed } = await admin.storage
        .from("cleaning-photos")
        .createSignedUrl(photo.path, 300);

      if (!signed?.signedUrl) {
        updated.push(photo);
        rowSkipped++;
        continue;
      }

      const exif = await extractExifFromUrl(signed.signedUrl);
      if (exif) {
        updated.push({ ...photo, exif });
        rowUpdated++;
      } else {
        updated.push(photo);
        rowSkipped++;
      }
    }

    if (rowUpdated > 0) {
      const { error: updateError } = await admin
        .from("cleaning_status")
        .update({ photos: updated })
        .eq("id", row.id);

      if (updateError) {
        console.error(`Failed to update row ${row.id}:`, updateError.message);
        rowSkipped += rowUpdated;
        rowUpdated = 0;
      }
    }

    totalUpdated += rowUpdated;
    totalSkipped += rowSkipped;
    summary.push({ registration_id: row.registration_id, updated: rowUpdated, skipped: rowSkipped });
  }

  return NextResponse.json({ updated: totalUpdated, skipped: totalSkipped, rows: summary });
}
