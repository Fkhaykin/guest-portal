import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { GuestPhotoStatus } from "@/types/database";

const BUCKET = "guest-photos";
const SIGNED_TTL = 3600; // 1h

// Photo-booth moderation. RLS scopes every row to the host's own properties;
// the service-role client only signs/removes storage objects.

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: rows, error } = await supabase
    .from("guest_photo")
    .select("id, property_id, file_path, taken_by_name, status, created_at, published_at, property:property_id(name, nickname)")
    .in("status", ["guest_approved", "published"])
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const admin = createAdminClient();
  const photos = await Promise.all(
    (rows ?? []).map(async (r) => {
      const { data: signed } = await admin.storage
        .from(BUCKET)
        .createSignedUrl(r.file_path, SIGNED_TTL);
      return { ...r, url: signed?.signedUrl ?? null };
    })
  );

  return NextResponse.json({ photos });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, status } = (await request.json()) as { id?: string; status?: GuestPhotoStatus };
  const valid: GuestPhotoStatus[] = ["guest_approved", "published", "rejected"];
  if (!id || !status || !valid.includes(status)) {
    return NextResponse.json({ error: "id and a valid status are required" }, { status: 400 });
  }

  // RLS-scoped update — only succeeds for photos on the host's own properties.
  const { data: photo, error } = await supabase
    .from("guest_photo")
    .update({
      status,
      published_at: status === "published" ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .select("id, status")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!photo) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }

  return NextResponse.json({ photo });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = (await request.json()) as { id?: string };
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { data: deleted, error } = await supabase
    .from("guest_photo")
    .delete()
    .eq("id", id)
    .select("file_path")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!deleted) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }

  const admin = createAdminClient();
  const { error: storageError } = await admin.storage.from(BUCKET).remove([deleted.file_path]);
  if (storageError) {
    console.error("[admin/guest-photos] storage remove failed:", storageError);
  }

  return NextResponse.json({ success: true });
}
