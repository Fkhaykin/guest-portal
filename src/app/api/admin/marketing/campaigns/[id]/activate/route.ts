import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireHost } from "@/lib/marketing/auth";
import type { CampaignStatus } from "@/types/database";

// POST { status: 'active' | 'paused' | 'archived' }
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireHost();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;

  const { status } = (await request.json()) as { status: CampaignStatus };
  if (!["active", "paused", "archived"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: campaign } = await admin
    .from("marketing_campaign")
    .select("kind")
    .eq("id", id)
    .eq("host_id", auth.hostId)
    .maybeSingle();
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (campaign.kind !== "drip") {
    return NextResponse.json(
      { error: "Only drip campaigns can be activated/paused" },
      { status: 400 }
    );
  }

  const { error } = await admin
    .from("marketing_campaign")
    .update({ status })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
