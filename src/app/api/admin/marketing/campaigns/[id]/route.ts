import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireHost } from "@/lib/marketing/auth";
import type { CampaignChannel, CampaignStatus } from "@/types/database";

async function loadCampaign(id: string, hostId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("marketing_campaign")
    .select("*")
    .eq("id", id)
    .eq("host_id", hostId)
    .maybeSingle();
  return data;
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireHost();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;

  const admin = createAdminClient();
  const { data: campaign } = await admin
    .from("marketing_campaign")
    .select("*, segment:segment_id(*)")
    .eq("id", id)
    .eq("host_id", auth.hostId)
    .maybeSingle();

  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: steps } = await admin
    .from("marketing_campaign_step")
    .select("*")
    .eq("campaign_id", id)
    .order("step_order");

  // Send stats per step
  const { data: sends } = await admin
    .from("marketing_campaign_send")
    .select("step_id, status")
    .eq("campaign_id", id);

  const statsByStep: Record<string, Record<string, number>> = {};
  for (const s of sends ?? []) {
    statsByStep[s.step_id] = statsByStep[s.step_id] || {};
    statsByStep[s.step_id][s.status] = (statsByStep[s.step_id][s.status] || 0) + 1;
  }

  return NextResponse.json({ campaign, steps: steps ?? [], stats: statsByStep });
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireHost();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;

  const existing = await loadCampaign(id, auth.hostId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await request.json()) as {
    name?: string;
    status?: CampaignStatus;
    default_channel?: CampaignChannel;
    send_cap_days?: number | null;
    discount_code?: string | null;
    direct_book_url?: string | null;
    steps?: {
      id?: string;
      delay_days_after_checkout: number | null;
      subject: string | null;
      html_body: string | null;
      text_body: string | null;
      channel_override?: CampaignChannel | null;
    }[];
  };

  const admin = createAdminClient();

  if (body.name !== undefined || body.status !== undefined || body.default_channel !== undefined ||
      body.send_cap_days !== undefined || body.discount_code !== undefined || body.direct_book_url !== undefined) {
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.status !== undefined) updates.status = body.status;
    if (body.default_channel !== undefined) updates.default_channel = body.default_channel;
    if (body.send_cap_days !== undefined) updates.send_cap_days = body.send_cap_days;
    if (body.discount_code !== undefined) updates.discount_code = body.discount_code;
    if (body.direct_book_url !== undefined) updates.direct_book_url = body.direct_book_url;
    const { error } = await admin.from("marketing_campaign").update(updates).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (body.steps) {
    // Replace step set: delete all, re-insert.
    await admin.from("marketing_campaign_step").delete().eq("campaign_id", id);
    const stepRows = body.steps.map((s, i) => ({
      campaign_id: id,
      step_order: i + 1,
      delay_days_after_checkout:
        existing.kind === "manual" ? null : s.delay_days_after_checkout,
      subject: s.subject,
      html_body: s.html_body,
      text_body: s.text_body,
      channel_override: s.channel_override ?? null,
    }));
    if (stepRows.length > 0) {
      const { error } = await admin.from("marketing_campaign_step").insert(stepRows);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireHost();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;

  const admin = createAdminClient();
  const { error } = await admin
    .from("marketing_campaign")
    .delete()
    .eq("id", id)
    .eq("host_id", auth.hostId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
