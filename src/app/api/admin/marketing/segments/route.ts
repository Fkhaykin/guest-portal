import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireHost } from "@/lib/marketing/auth";
import { evaluateSegment } from "@/lib/marketing/segments";
import type { SegmentFilter } from "@/types/database";

export async function GET() {
  const auth = await requireHost();
  if ("error" in auth) return auth.error;

  const admin = createAdminClient();
  const { data: segments, error } = await admin
    .from("guest_segment")
    .select("*")
    .eq("host_id", auth.hostId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Attach live counts (cheap enough for small numbers of segments)
  const withCounts = await Promise.all(
    (segments ?? []).map(async (s) => {
      const members = await evaluateSegment(auth.hostId, s.filter as SegmentFilter);
      return {
        ...s,
        member_count: members.length,
        reachable_email: members.filter((m) => m.email).length,
        reachable_sms: members.filter((m) => m.phone).length,
      };
    })
  );

  return NextResponse.json({ segments: withCounts });
}

export async function POST(request: NextRequest) {
  const auth = await requireHost();
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const { name, description, filter } = body as {
    name: string;
    description?: string;
    filter: SegmentFilter;
  };

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("guest_segment")
    .insert({
      host_id: auth.hostId,
      name,
      description: description ?? null,
      filter: filter ?? {},
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ segment: data });
}
