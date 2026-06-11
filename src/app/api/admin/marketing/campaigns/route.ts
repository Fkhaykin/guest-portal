import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireHost } from "@/lib/marketing/auth";
import type { CampaignChannel, CampaignKind } from "@/types/database";

export async function GET() {
  const auth = await requireHost();
  if ("error" in auth) return auth.error;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("marketing_campaign")
    .select("*, segment:segment_id(id, name)")
    .eq("host_id", auth.hostId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ campaigns: data ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireHost();
  if ("error" in auth) return auth.error;

  const body = (await request.json()) as {
    name: string;
    kind: CampaignKind;
    segment_id: string;
    default_channel?: CampaignChannel;
    send_cap_days?: number | null;
    discount_code?: string | null;
    direct_book_url?: string | null;
    steps: {
      delay_days_after_checkout: number | null;
      subject: string | null;
      html_body: string | null;
      text_body: string | null;
      channel_override?: CampaignChannel | null;
    }[];
  };

  if (!body.name || !body.kind || !body.segment_id) {
    return NextResponse.json(
      { error: "name, kind, and segment_id are required" },
      { status: 400 }
    );
  }
  if (!Array.isArray(body.steps) || body.steps.length === 0) {
    return NextResponse.json({ error: "at least one step is required" }, { status: 400 });
  }
  if (body.kind === "manual" && body.steps.length !== 1) {
    return NextResponse.json(
      { error: "manual campaigns must have exactly one step" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Verify segment belongs to this host
  const { data: segment } = await admin
    .from("guest_segment")
    .select("id")
    .eq("id", body.segment_id)
    .eq("host_id", auth.hostId)
    .maybeSingle();
  if (!segment) {
    return NextResponse.json({ error: "Segment not found" }, { status: 404 });
  }

  const { data: campaign, error: cErr } = await admin
    .from("marketing_campaign")
    .insert({
      host_id: auth.hostId,
      segment_id: body.segment_id,
      name: body.name,
      kind: body.kind,
      status: "draft",
      default_channel: body.default_channel ?? "auto",
      send_cap_days: body.send_cap_days ?? null,
      discount_code: body.discount_code ?? null,
      direct_book_url: body.direct_book_url ?? null,
    })
    .select()
    .single();

  if (cErr || !campaign) {
    return NextResponse.json({ error: cErr?.message ?? "Failed to create" }, { status: 500 });
  }

  const stepRows = body.steps.map((s, i) => ({
    campaign_id: campaign.id,
    step_order: i + 1,
    delay_days_after_checkout: body.kind === "manual" ? null : s.delay_days_after_checkout,
    subject: s.subject,
    html_body: s.html_body,
    text_body: s.text_body,
    channel_override: s.channel_override ?? null,
  }));

  const { error: sErr } = await admin.from("marketing_campaign_step").insert(stepRows);
  if (sErr) {
    await admin.from("marketing_campaign").delete().eq("id", campaign.id);
    return NextResponse.json({ error: sErr.message }, { status: 500 });
  }

  return NextResponse.json({ campaign });
}
