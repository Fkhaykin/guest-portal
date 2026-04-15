import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateCleanerSession } from "@/lib/cleaner/auth";
import { getSessionToken } from "@/lib/cleaner/session";

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

    if (!file || !registrationId) {
      return NextResponse.json(
        { error: "file and registration_id are required" },
        { status: 400 }
      );
    }

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
      return NextResponse.json({ error: "No properties assigned" }, { status: 403 });
    }

    const { data: reg } = await supabase
      .from("registration")
      .select("id")
      .eq("id", registrationId)
      .in("property_id", propertyIds)
      .single();

    if (!reg) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }

    const ext = fileExt || "jpg";
    const path = `${registrationId}/damage-${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from("damage-photos")
      .upload(path, buffer, {
        contentType: resolvedType,
        upsert: false,
      });

    if (uploadError) {
      console.error("Damage photo upload error:", uploadError);
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, path });
  } catch (err) {
    console.error("Upload damage photo error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
