import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyGuestToken } from "@/lib/guest-token";

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

  // Verify registration exists
  const { data: reg } = await supabase
    .from("registration")
    .select("id")
    .eq("id", registrationId)
    .single();

  if (!reg) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 });
  }

  const ext = file.name.split(".").pop() || "pdf";
  const path = `${registrationId}/pet-${petIndex}-${docType}.${ext}`;

  const buffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from("pet-documents")
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    console.error("[upload-pet-doc] Upload failed:", uploadError);
    return NextResponse.json(
      { error: "Upload failed. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, path });
}
