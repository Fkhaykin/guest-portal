import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { property_id, is_active } = await request.json();
  if (!property_id || typeof is_active !== "boolean") {
    return NextResponse.json(
      { error: "property_id and is_active (boolean) are required" },
      { status: 400 }
    );
  }

  // Verify the caller owns this property
  const admin = createAdminClient();
  const { data: property } = await admin
    .from("property")
    .select("host_id")
    .eq("id", property_id)
    .single();

  if (!property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  const { data: host } = await supabase
    .from("host")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (!host || host.id !== property.host_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await admin
    .from("property")
    .update({ is_active })
    .eq("id", property_id);

  if (error) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  return NextResponse.json({ is_active });
}
