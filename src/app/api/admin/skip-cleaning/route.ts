import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: host } = await supabase
    .from("host")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  if (!host) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { registration_ids: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { registration_ids } = body;
  if (!registration_ids?.length) {
    return NextResponse.json({ error: "Missing registration_ids" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify all registrations belong to properties owned by this host
  const { data: regs } = await admin
    .from("registration")
    .select("id, property:property_id(host_id)")
    .in("id", registration_ids);

  const validIds = (regs || [])
    .filter((r) => {
      const property = r.property as unknown as { host_id: string } | null;
      return property?.host_id === host.id;
    })
    .map((r) => r.id);

  if (validIds.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { error } = await admin
    .from("cleaning_status")
    .update({ is_skipped: true })
    .in("registration_id", validIds);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, skipped: validIds.length });
}
