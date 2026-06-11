import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: claims, error } = await supabase
    .from("aircover_claim")
    .select(
      `
      *,
      registration:registration_id(
        id,
        check_in_date,
        check_out_date,
        guest:guest_id(full_name, email, phone),
        pets
      ),
      property:property_id(name, nickname),
      cleaner:cleaner_id(name)
    `
    )
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ claims });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, status } = await request.json();
  if (!id || !status) {
    return NextResponse.json(
      { error: "id and status are required" },
      { status: 400 }
    );
  }

  const validStatuses = ["open", "claim_filed", "claim_approved", "claim_denied"];
  if (!validStatuses.includes(status)) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
      { status: 400 }
    );
  }

  const { data: claim, error } = await supabase
    .from("aircover_claim")
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ claim });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  // RLS-scoped delete: only succeeds for claims on the host's own properties
  const { data: deleted, error } = await supabase
    .from("aircover_claim")
    .delete()
    .eq("id", id)
    .select("id, damage_photos")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!deleted) {
    return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  }

  if (deleted.damage_photos?.length) {
    const admin = createAdminClient();
    const { error: storageError } = await admin.storage
      .from("damage-photos")
      .remove(deleted.damage_photos);
    if (storageError) {
      console.error("Failed to remove damage photos:", storageError);
    }
  }

  return NextResponse.json({ success: true });
}
