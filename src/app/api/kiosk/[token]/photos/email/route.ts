import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyGuestToken } from "@/lib/guest-token";
import { resolveKioskProperty } from "@/lib/kiosk";
import { sendGuestPhotoEmail } from "@/lib/email/send-guest-photo";

const BUCKET = "guest-photos";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Email a guest a copy of a photo they took at the kiosk (the alternative to
// the QR "save to phone"). Attaches the image; no link, so it's unaffected by
// the SMS URL whitelist state.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const admin = createAdminClient();

  const property = await resolveKioskProperty(admin, token);
  if (!property) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: { id?: string; registration_id?: string; email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { id, registration_id, email } = body;
  if (!id || !registration_id || !email) {
    return NextResponse.json(
      { error: "id, registration_id, and email are required" },
      { status: 400 }
    );
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }

  const guestToken = request.headers.get("x-guest-token") ?? "";
  if (!verifyGuestToken(registration_id, guestToken)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // The photo must belong to this reservation.
  const { data: photo } = await admin
    .from("guest_photo")
    .select("file_path")
    .eq("id", id)
    .eq("registration_id", registration_id)
    .maybeSingle();
  if (!photo) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }

  const { data: blob, error: dlError } = await admin.storage
    .from(BUCKET)
    .download(photo.file_path);
  if (dlError || !blob) {
    return NextResponse.json({ error: "Could not read photo" }, { status: 500 });
  }

  const contentType = blob.type || "image/jpeg";
  const ext = contentType.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
  const base64 = Buffer.from(await blob.arrayBuffer()).toString("base64");

  const result = await sendGuestPhotoEmail({
    to: email,
    propertyName: property.name,
    contentBase64: base64,
    contentType,
    filename: `${property.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-photo.${ext}`,
  });
  if (!result.success) {
    return NextResponse.json({ error: result.error || "Could not send email" }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}
