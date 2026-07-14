import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyGuestToken } from "@/lib/guest-token";
import { resolveKioskProperty } from "@/lib/kiosk";
import { nicknamePropertyIds } from "@/lib/pricing/data";

// Guest photo booth. Each kept photo is uploaded once and enters moderation as
// `guest_approved`. Reads sign URLs on the fly (private bucket). All calls
// require the guest token for the current reservation (x-guest-token), mirroring
// the tip-checkout guard.

const BUCKET = "guest-photos";
const THUMB_TTL = 3600; // 1h — album thumbnails
const SHARE_TTL = 60 * 60 * 24 * 7; // 7 days — the QR/download link on the kiosk
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

type Admin = ReturnType<typeof createAdminClient>;

// Token → property → the reservation must belong to this house (nickname group,
// since some houses span two property rows). Returns the resolved property IDs.
async function authorize(
  admin: Admin,
  token: string,
  registrationId: string,
  guestToken: string
): Promise<
  | { ok: true; propertyId: string; houseIds: string[] }
  | { ok: false; status: number; error: string }
> {
  const property = await resolveKioskProperty(admin, token);
  if (!property) return { ok: false, status: 404, error: "Not found" };

  if (!registrationId || !guestToken || !verifyGuestToken(registrationId, guestToken)) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const houseIds = property.nickname
    ? await nicknamePropertyIds(admin, property.nickname)
    : [property.id];
  const ids = houseIds.length ? houseIds : [property.id];

  const { data: reg } = await admin
    .from("registration")
    .select("id, property_id")
    .eq("id", registrationId)
    .maybeSingle();
  if (!reg || !ids.includes(reg.property_id)) {
    return { ok: false, status: 404, error: "Registration not found" };
  }

  return { ok: true, propertyId: property.id, houseIds: ids };
}

// POST — upload a kept photo (multipart: file, registration_id). Returns the
// row id and a share URL so the kiosk can render a QR immediately.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const admin = createAdminClient();

  const form = await request.formData();
  const file = form.get("file") as File | null;
  const registrationId = form.get("registration_id") as string | null;
  const takenByName = (form.get("taken_by_name") as string | null) ?? null;

  if (!file || !registrationId) {
    return NextResponse.json(
      { error: "file and registration_id are required" },
      { status: 400 }
    );
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: "Photo must be JPEG, PNG, or WebP" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Photo is too large" }, { status: 400 });
  }

  const auth = await authorize(
    admin,
    token,
    registrationId,
    request.headers.get("x-guest-token") ?? ""
  );
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${auth.propertyId}/${registrationId}/${crypto.randomUUID()}.${ext}`;
  const buffer = await file.arrayBuffer();

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false });
  if (uploadError) {
    console.error("[kiosk/photos] upload failed:", uploadError);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }

  const { data: row, error: insertError } = await admin
    .from("guest_photo")
    .insert({
      registration_id: registrationId,
      property_id: auth.propertyId,
      file_path: path,
      taken_by_name: takenByName?.trim() || null,
      status: "guest_approved",
    })
    .select("id")
    .single();
  if (insertError || !row) {
    await admin.storage.from(BUCKET).remove([path]);
    console.error("[kiosk/photos] insert failed:", insertError);
    return NextResponse.json({ error: "Could not save photo." }, { status: 500 });
  }

  const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(path, SHARE_TTL);

  return NextResponse.json({ id: row.id, url: signed?.signedUrl ?? null });
}

// GET — the guest's own album (kept + published), newest first, with 1h URLs.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const admin = createAdminClient();

  const url = new URL(request.url);
  const registrationId = url.searchParams.get("registration_id") ?? "";
  const auth = await authorize(
    admin,
    token,
    registrationId,
    request.headers.get("x-guest-token") ?? ""
  );
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data: rows } = await admin
    .from("guest_photo")
    .select("id, file_path, status, created_at")
    .eq("registration_id", registrationId)
    .in("status", ["guest_approved", "published"])
    .order("created_at", { ascending: false });

  const photos = await Promise.all(
    (rows ?? []).map(async (r) => {
      const { data: signed } = await admin.storage
        .from(BUCKET)
        .createSignedUrl(r.file_path, THUMB_TTL);
      return { id: r.id, status: r.status, created_at: r.created_at, url: signed?.signedUrl ?? null };
    })
  );

  return NextResponse.json({ photos });
}

// DELETE — guest removes their own photo (row + object). Scoped to their reg.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const admin = createAdminClient();

  let body: { id?: string; registration_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { id, registration_id } = body;
  if (!id || !registration_id) {
    return NextResponse.json({ error: "id and registration_id are required" }, { status: 400 });
  }

  const auth = await authorize(
    admin,
    token,
    registration_id,
    request.headers.get("x-guest-token") ?? ""
  );
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data: deleted } = await admin
    .from("guest_photo")
    .delete()
    .eq("id", id)
    .eq("registration_id", registration_id)
    .select("file_path")
    .maybeSingle();

  if (deleted?.file_path) {
    await admin.storage.from(BUCKET).remove([deleted.file_path]);
  }

  return NextResponse.json({ success: true });
}
