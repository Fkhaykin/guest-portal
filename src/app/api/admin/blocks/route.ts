import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pushBlockHold, releaseBlockHold } from "@/lib/lodgify/block-hold";

/** All property ids that share a nickname with the given property (a physical
 *  house is often two Lodgify listings). Falls back to the single id. */
async function nicknameGroup(
  admin: ReturnType<typeof createAdminClient>,
  propertyId: string
): Promise<{ ids: string[]; nickname: string | null } | null> {
  const { data: prop } = await admin
    .from("property")
    .select("id, nickname")
    .eq("id", propertyId)
    .maybeSingle();
  if (!prop) return null;
  if (!prop.nickname) return { ids: [prop.id], nickname: null };
  const { data: siblings } = await admin
    .from("property")
    .select("id")
    .ilike("nickname", prop.nickname);
  return { ids: siblings?.length ? siblings.map((s) => s.id) : [prop.id], nickname: prop.nickname };
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// GET /api/admin/blocks?property_id=<uuid> — list blocks for the house.
export async function GET(request: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const propertyId = request.nextUrl.searchParams.get("property_id");
  if (!propertyId) return NextResponse.json({ error: "property_id required" }, { status: 400 });

  const admin = createAdminClient();
  const group = await nicknameGroup(admin, propertyId);
  if (!group) return NextResponse.json({ error: "Property not found" }, { status: 404 });

  const { data: blocks } = await admin
    .from("property_block")
    .select("id, property_id, start_date, end_date, reason, lodgify_booking_id, lodgify_sync_status, created_at")
    .in("property_id", group.ids)
    .order("start_date", { ascending: true });

  return NextResponse.json({ blocks: blocks ?? [] });
}

// POST /api/admin/blocks — create an owner block and hold it on Lodgify.
export async function POST(request: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { property_id: string; start_date: string; end_date: string; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.property_id || !body.start_date || !body.end_date) {
    return NextResponse.json({ error: "property_id, start_date and end_date are required" }, { status: 400 });
  }
  if (body.end_date <= body.start_date) {
    return NextResponse.json({ error: "End date must be after start date" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: prop } = await admin
    .from("property")
    .select("id")
    .eq("id", body.property_id)
    .maybeSingle();
  if (!prop) return NextResponse.json({ error: "Property not found" }, { status: 404 });

  const { data: block, error } = await admin
    .from("property_block")
    .insert({
      property_id: body.property_id,
      start_date: body.start_date,
      end_date: body.end_date,
      reason: body.reason?.trim() || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !block) {
    console.error("[admin/blocks] insert failed:", error);
    return NextResponse.json({ error: "Failed to create block", details: error?.message }, { status: 500 });
  }

  // Hold the dates on Lodgify so OTA channels can't book them. Non-fatal.
  await pushBlockHold(block.id, admin);

  const { data: created } = await admin
    .from("property_block")
    .select("id, property_id, start_date, end_date, reason, lodgify_booking_id, lodgify_sync_status, created_at")
    .eq("id", block.id)
    .single();

  return NextResponse.json({ block: created, ota_held: created?.lodgify_sync_status === "synced" });
}

// PATCH /api/admin/blocks — edit a block's dates/reason. Lodgify has no
// update API, so a date change moves the hold: release the old synthetic
// booking, then push a fresh one for the new dates.
export async function PATCH(request: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { id: string; start_date: string; end_date: string; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.id || !body.start_date || !body.end_date) {
    return NextResponse.json({ error: "id, start_date and end_date are required" }, { status: 400 });
  }
  if (body.end_date <= body.start_date) {
    return NextResponse.json({ error: "End date must be after start date" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: block } = await admin
    .from("property_block")
    .select("id, start_date, end_date, lodgify_booking_id")
    .eq("id", body.id)
    .maybeSingle();
  if (!block) return NextResponse.json({ error: "Block not found" }, { status: 404 });

  const datesChanged = block.start_date !== body.start_date || block.end_date !== body.end_date;

  // Moving dates: release the old hold first. If Lodgify refuses, keep going —
  // the local block and new hold must still land — and warn so the admin can
  // remove the stale Lodgify booking by hand.
  let otaReleased = true;
  const priorHoldId = block.lodgify_booking_id;
  if (datesChanged && priorHoldId) {
    otaReleased = await releaseBlockHold(priorHoldId);
    await admin
      .from("property_block")
      .update({ lodgify_booking_id: null, lodgify_sync_status: null })
      .eq("id", body.id);
  }

  await admin
    .from("property_block")
    .update({ start_date: body.start_date, end_date: body.end_date, reason: body.reason?.trim() || null })
    .eq("id", body.id);

  // Re-hold on Lodgify when dates moved, or retry a hold that never succeeded.
  if (datesChanged || !priorHoldId) {
    await pushBlockHold(body.id, admin);
  }

  const { data: updated } = await admin
    .from("property_block")
    .select("id, property_id, start_date, end_date, reason, lodgify_booking_id, lodgify_sync_status, created_at")
    .eq("id", body.id)
    .single();

  return NextResponse.json({
    block: updated,
    ota_held: updated?.lodgify_sync_status === "synced",
    ota_released: otaReleased,
    prior_lodgify_booking_id: priorHoldId,
  });
}

// DELETE /api/admin/blocks?id=<uuid> — remove a block and release its OTA hold.
export async function DELETE(request: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: block } = await admin
    .from("property_block")
    .select("id, lodgify_booking_id")
    .eq("id", id)
    .maybeSingle();
  if (!block) return NextResponse.json({ error: "Block not found" }, { status: 404 });

  const otaReleased = await releaseBlockHold(block.lodgify_booking_id);
  await admin.from("property_block").delete().eq("id", id);

  // otaReleased=false means a Lodgify hold still blocks the OTA calendar; the UI
  // warns the admin to remove Lodgify booking #lodgify_booking_id manually.
  return NextResponse.json({ ok: true, ota_released: otaReleased, lodgify_booking_id: block.lodgify_booking_id });
}
