import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireHost } from "@/lib/marketing/auth";
import { evaluateSegment } from "@/lib/marketing/segments";
import { sendCampaignStep } from "@/lib/marketing/send";
import type { SegmentFilter } from "@/types/database";

export const maxDuration = 60;

// POST — send a manual (one-shot) campaign to its segment NOW.
// For drip campaigns this returns 400; use /activate instead.
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireHost();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;

  const admin = createAdminClient();
  const { data: campaign } = await admin
    .from("marketing_campaign")
    .select("*")
    .eq("id", id)
    .eq("host_id", auth.hostId)
    .maybeSingle();
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (campaign.kind !== "manual") {
    return NextResponse.json(
      { error: "Use /activate for drip campaigns" },
      { status: 400 }
    );
  }
  if (!campaign.segment_id) {
    return NextResponse.json({ error: "Campaign has no segment" }, { status: 400 });
  }

  const { data: segment } = await admin
    .from("guest_segment")
    .select("filter")
    .eq("id", campaign.segment_id)
    .single();
  if (!segment) return NextResponse.json({ error: "Segment not found" }, { status: 404 });

  const { data: steps } = await admin
    .from("marketing_campaign_step")
    .select("*")
    .eq("campaign_id", id)
    .order("step_order");
  if (!steps || steps.length === 0) {
    return NextResponse.json({ error: "Campaign has no steps" }, { status: 400 });
  }

  const members = await evaluateSegment(auth.hostId, segment.filter as SegmentFilter);
  if (members.length === 0) {
    return NextResponse.json({ error: "Segment is empty" }, { status: 400 });
  }

  const result = await sendCampaignStep(campaign, steps[0], members);

  await admin
    .from("marketing_campaign")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", id);

  return NextResponse.json({ result, recipients: members.length });
}
