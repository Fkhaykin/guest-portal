import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const registrationId = formData.get("registration_id") as string | null;
  const side = formData.get("side") as string | null; // "front" | "back"

  if (!file || !registrationId || !side) {
    return NextResponse.json(
      { error: "file, registration_id, and side are required" },
      { status: 400 }
    );
  }

  const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { error: "File must be a PDF, JPEG, PNG, or WebP" },
      { status: 400 }
    );
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json(
      { error: "File must be under 10MB" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const { data: reg } = await supabase
    .from("registration")
    .select("id")
    .eq("id", registrationId)
    .single();

  if (!reg) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 });
  }

  const ext = file.name.split(".").pop() || "png";
  const path = `${registrationId}/id-${side}.${ext}`;

  const buffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from("registrations")
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    console.error("[upload-id] Upload failed:", uploadError);
    return NextResponse.json(
      { error: "Upload failed. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, path });
}
