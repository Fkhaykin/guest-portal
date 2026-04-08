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

  let body: { registration_id: string; path: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { registration_id, path } = body;
  if (!registration_id || !path) {
    return NextResponse.json(
      { error: "registration_id and path are required" },
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

  const { data: reg } = await supabase
    .from("registration")
    .select("id, property_id")
    .eq("id", registration_id)
    .in("property_id", propertyIds)
    .single();

  if (!reg) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 });
  }

  // Remove photo from cleaning_status record
  const { data: status } = await supabase
    .from("cleaning_status")
    .select("photos")
    .eq("registration_id", registration_id)
    .single();

  if (status?.photos) {
    const updatedPhotos = (status.photos as { room: string; path: string; uploaded_at: string }[])
      .filter((p) => p.path !== path);

    await supabase
      .from("cleaning_status")
      .update({ photos: updatedPhotos })
      .eq("registration_id", registration_id);
  }

  // Remove file from storage
  await supabase.storage.from("cleaning-photos").remove([path]);

  return NextResponse.json({ ok: true });
}
