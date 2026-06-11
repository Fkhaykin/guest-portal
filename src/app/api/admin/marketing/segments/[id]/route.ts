import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireHost } from "@/lib/marketing/auth";
import type { SegmentFilter } from "@/types/database";

async function loadSegment(id: string, hostId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("guest_segment")
    .select("*")
    .eq("id", id)
    .eq("host_id", hostId)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireHost();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const segment = await loadSegment(id, auth.hostId);
  if (!segment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ segment });
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireHost();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;

  const segment = await loadSegment(id, auth.hostId);
  if (!segment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updates = (await request.json()) as {
    name?: string;
    description?: string | null;
    filter?: SegmentFilter;
  };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("guest_segment")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ segment: data });
}

export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireHost();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;

  const admin = createAdminClient();
  // Block if a campaign still references it
  const { count } = await admin
    .from("marketing_campaign")
    .select("id", { count: "exact", head: true })
    .eq("segment_id", id);
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: "Cannot delete: segment is used by one or more campaigns" },
      { status: 409 }
    );
  }

  const { error } = await admin
    .from("guest_segment")
    .delete()
    .eq("id", id)
    .eq("host_id", auth.hostId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
