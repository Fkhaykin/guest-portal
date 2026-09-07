import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyGuestToken } from "@/lib/guest-token";
import convertHeic from "heic-convert";
import sharp from "sharp";

// Stored as-is, mapped to the extension we store it under. PDFKit can embed
// jpg/png into the PEPOA appendix, and browsers can display them.
const PASSTHROUGH: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

// Accepted from the guest but converted to JPEG before storage. PDFKit can
// embed neither into the PEPOA packet — a WebP upload used to look like it
// worked and then silently vanish from the HOA's copy — and browsers can't
// display HEIC either.
const CONVERT_TO_JPEG = [
  "image/webp",
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
];

const EXT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

/**
 * Browsers are inconsistent about the MIME type on phone uploads — Safari
 * usually sends image/heic for an iPhone photo, but some send an empty string
 * or application/octet-stream — so fall back to the filename extension.
 */
function resolveType(file: File): string {
  const type = file.type.toLowerCase();
  if (type && type !== "application/octet-stream") return type;
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  return EXT_TYPES[ext] ?? type;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const registrationId = formData.get("registration_id") as string | null;
  const petIndex = formData.get("pet_index") as string | null;
  const docType = formData.get("doc_type") as string | null; // "rabies" | "vaccination"

  if (!file || !registrationId || petIndex === null || !docType) {
    return NextResponse.json(
      { error: "file, registration_id, pet_index, and doc_type are required" },
      { status: 400 }
    );
  }

  const token = request.headers.get("x-guest-token") || "";
  if (!verifyGuestToken(registrationId, token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json(
      { error: "That file is larger than 10MB. Please upload a smaller file." },
      { status: 400 }
    );
  }

  const resolvedType = resolveType(file);
  const needsConversion = CONVERT_TO_JPEG.includes(resolvedType);
  if (!needsConversion && !PASSTHROUGH[resolvedType]) {
    return NextResponse.json(
      { error: "That file type isn't supported. Please upload a PDF or a photo (HEIC, JPEG, PNG, or WebP)." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Verify registration exists
  const { data: reg } = await supabase
    .from("registration")
    .select("id")
    .eq("id", registrationId)
    .single();

  if (!reg) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 });
  }

  let buffer: Buffer = Buffer.from(await file.arrayBuffer());
  let contentType = resolvedType;
  let ext: string;

  if (needsConversion) {
    const isHeic = resolvedType !== "image/webp";
    try {
      // libheif decodes HEIC; sharp handles WebP directly.
      const decoded = isHeic
        ? Buffer.from(await convertHeic({ buffer, format: "JPEG", quality: 0.9 }))
        : buffer;
      buffer = await sharp(decoded)
        .rotate() // honour the EXIF orientation before it's stripped
        .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 82, mozjpeg: true })
        .toBuffer();
    } catch (err) {
      console.error("[upload-pet-doc] Conversion failed:", err);
      return NextResponse.json(
        {
          error: isHeic
            ? "We couldn't read that iPhone photo. Please try taking a screenshot of it and uploading that instead."
            : "We couldn't read that image. Please try a different file.",
        },
        { status: 422 }
      );
    }
    contentType = "image/jpeg";
    ext = "jpg";
  } else {
    ext = PASSTHROUGH[resolvedType];
  }

  const path = `${registrationId}/pet-${petIndex}-${docType}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("pet-documents")
    .upload(path, buffer, {
      contentType,
      upsert: true,
    });

  if (uploadError) {
    console.error("[upload-pet-doc] Upload failed:", uploadError);
    return NextResponse.json(
      { error: "Upload failed. Please try again." },
      { status: 500 }
    );
  }

  // A replacement can land on a different extension (cert.png -> cert.jpg),
  // which would otherwise leave the old file orphaned in the bucket.
  const { data: siblings } = await supabase.storage.from("pet-documents").list(registrationId);
  const superseded = (siblings ?? [])
    .filter((f) => f.name.startsWith(`pet-${petIndex}-${docType}.`) && `${registrationId}/${f.name}` !== path)
    .map((f) => `${registrationId}/${f.name}`);
  if (superseded.length) {
    await supabase.storage.from("pet-documents").remove(superseded);
  }

  return NextResponse.json({ ok: true, path });
}
