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

  const { registration_id, path } = await request.json();
  if (!registration_id || !path) {
    return NextResponse.json({ error: "registration_id and path required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Verify access
  const { data: assignments } = await supabase
    .from("cleaner_property")
    .select("property_id")
    .eq("cleaner_id", cleaner.id);

  const propertyIds = (assignments || []).map((a) => a.property_id);

  const { data: reg } = await supabase
    .from("registration")
    .select("id")
    .eq("id", registration_id)
    .in("property_id", propertyIds)
    .single();

  if (!reg) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 });
  }

  await supabase.storage.from("damage-photos").remove([path]);

  return NextResponse.json({ ok: true });
}
