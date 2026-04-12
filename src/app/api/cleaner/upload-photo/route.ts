import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateCleanerSession } from "@/lib/cleaner/auth";
import { getSessionToken } from "@/lib/cleaner/session";
import exifReader from "exif-reader";
import type { CleaningPhotoExif } from "@/types/database";

export async function POST(request: Request) {
  try {
    const token = await getSessionToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cleaner = await validateCleanerSession(token);
    if (!cleaner) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const registrationId = formData.get("registration_id") as string | null;
    const room = formData.get("room") as string | null;

    if (!file || !registrationId || !room) {
      return NextResponse.json(
        { error: "file, registration_id, and room are required" },
        { status: 400 }
      );
    }

    // Resolve MIME type — iOS sometimes sends application/octet-stream or empty type
    const extMimeMap: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      heic: "image/heic",
      heif: "image/heif",
    };
    const allowedTypes = Object.values(extMimeMap);
    const fileExt = file.name.split(".").pop()?.toLowerCase() || "";
    const resolvedType = allowedTypes.includes(file.type)
      ? file.type
      : extMimeMap[fileExt] || file.type;

    if (!allowedTypes.includes(resolvedType)) {
      return NextResponse.json(
        { error: "File must be JPEG, PNG, WebP, or HEIC" },
        { status: 400 }
      );
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File must be under 5MB" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Verify registration belongs to assigned property
    const { data: assignments } = await supabase
      .from("cleaner_property")
      .select("property_id")
      .eq("cleaner_id", cleaner.id);

    const propertyIds = (assignments || []).map((a) => a.property_id);

    if (propertyIds.length === 0) {
      return NextResponse.json(
        { error: "No properties assigned" },
        { status: 403 }
      );
    }

    const { data: reg } = await supabase
      .from("registration")
      .select("id, property_id, check_out_date")
      .eq("id", registrationId)
      .in("property_id", propertyIds)
      .single();

    if (!reg) {
      return NextResponse.json(
        { error: "Registration not found" },
        { status: 404 }
      );
    }

    // Upload photo
    const ext = fileExt || "jpg";
    const path = `${registrationId}/${room}-${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    // Extract EXIF metadata — try uploaded buffer first, fall back to original
    // header (sent when client-side compression stripped EXIF)
    const originalHeader = formData.get("original_header") as File | null;
    let exif: CleaningPhotoExif | undefined;

    let exifDebug: string | undefined;

    function parseExif(buf: Buffer, label: string): CleaningPhotoExif | undefined {
      try {
        const data = exifReader(buf);
        if (!data) { exifDebug = `${label}: exifReader returned falsy`; return undefined; }

        const dt =
          data.Photo?.DateTimeOriginal ??
          data.Photo?.DateTimeDigitized ??
          data.Image?.DateTime;
        const gpsInfo = data.GPSInfo;
        const make = data.Image?.Make;
        const model = data.Image?.Model;
        const width =
          data.Photo?.PixelXDimension ?? data.Image?.ImageWidth;
        const height =
          data.Photo?.PixelYDimension ?? data.Image?.ImageLength;

        const result: CleaningPhotoExif = {};
        if (dt) result.taken_at = dt instanceof Date ? dt.toISOString() : String(dt);
        if (gpsInfo?.GPSLatitude && gpsInfo?.GPSLongitude) {
          const toDecimal = (dms: number[]) =>
            dms[0] + dms[1] / 60 + dms[2] / 3600;
          let lat = toDecimal(gpsInfo.GPSLatitude);
          let lon = toDecimal(gpsInfo.GPSLongitude);
          if (gpsInfo.GPSLatitudeRef === "S") lat = -lat;
          if (gpsInfo.GPSLongitudeRef === "W") lon = -lon;
          result.latitude = lat;
          result.longitude = lon;
        }
        if (make || model) {
          result.camera = [make, model].filter(Boolean).join(" ");
        }
        if (width) result.width = width;
        if (height) result.height = height;

        return Object.keys(result).length > 0 ? result : undefined;
      } catch (err) {
        exifDebug = `${label}: ${err instanceof Error ? err.message : String(err)}`;
        return undefined;
      }
    }

    exif = parseExif(buffer, `uploaded(${file.size}b,${resolvedType})`);
    if (!exif && originalHeader) {
      try {
        const headerBuf = Buffer.from(await originalHeader.arrayBuffer());
        exif = parseExif(headerBuf, `header(${headerBuf.length}b)`);
      } catch {
        // ignore
      }
    }

    // Reject photos taken before the checkout date
    if (exif?.taken_at && reg.check_out_date) {
      const photoDate = new Date(exif.taken_at);
      const checkOutDate = new Date(reg.check_out_date + "T00:00:00");
      if (photoDate < checkOutDate) {
        const photoDateStr = photoDate.toLocaleDateString("en-US", {
          month: "short", day: "numeric", year: "numeric",
        });
        const checkOutStr = new Date(reg.check_out_date + "T00:00:00").toLocaleDateString("en-US", {
          month: "short", day: "numeric", year: "numeric",
        });
        return NextResponse.json(
          { error: `Sorry, this photo was taken on ${photoDateStr}. Photos must be taken after the checkout date of ${checkOutStr}.` },
          { status: 400 }
        );
      }
    }

    const { error: uploadError } = await supabase.storage
      .from("cleaning-photos")
      .upload(path, buffer, {
        contentType: resolvedType,
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Persist photo to cleaning_status record immediately
    const photo = { room, path, uploaded_at: new Date().toISOString(), ...(exif && { exif }) };

    // Ensure cleaning_status row exists, then atomically append the photo.
    // Using ignoreDuplicates so concurrent inserts don't conflict.
    const { error: upsertError } = await supabase
      .from("cleaning_status")
      .upsert(
        {
          registration_id: registrationId,
          cleaner_id: cleaner.id,
          photos: [],
        },
        { onConflict: "registration_id", ignoreDuplicates: true }
      );

    if (upsertError) {
      console.error("Failed to upsert cleaning_status:", upsertError);
    }

    const { error: appendError } = await supabase.rpc(
      "append_cleaning_photo",
      {
        p_registration_id: registrationId,
        p_photo: photo,
      }
    );

    if (appendError) {
      console.error("Failed to save photo metadata:", appendError);
    }

    return NextResponse.json({ ok: true, photo, ...(exifDebug && { exifDebug }) });
  } catch (err) {
    console.error("Upload photo error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
