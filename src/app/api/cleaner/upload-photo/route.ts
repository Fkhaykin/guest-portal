import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateCleanerSession } from "@/lib/cleaner/auth";
import { getSessionToken } from "@/lib/cleaner/session";

export async function POST(request: Request) {
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

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/heic"];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { error: "File must be JPEG, PNG, WebP, or HEIC" },
      { status: 400 }
    );
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "File must be under 5MB" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Verify registration belongs to assigned property
  const { data: assignments } = await supabase
    .from("cleaner_property")
    .select("property_id")
    .eq("cleaner_id", cleaner.id);

  const propertyIds = (assignments || []).map((a) => a.property_id);

  const { data: reg } = await supabase
    .from("registration")
    .select("id, property_id")
    .eq("id", registrationId)
    .in("property_id", propertyIds)
    .single();

  if (!reg) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 });
  }

  // Upload photo
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${registrationId}/${room}-${Date.now()}.${ext}`;
  const buffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from("cleaning-photos")
    .upload(path, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    photo: {
      room,
      path,
      uploaded_at: new Date().toISOString(),
    },
  });
}
