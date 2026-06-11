import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireHost } from "@/lib/marketing/auth";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireHost();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;

  const admin = createAdminClient();
  // Verify campaign is host's
  const { data: campaign } = await admin
    .from("marketing_campaign")
    .select("id")
    .eq("id", id)
    .eq("host_id", auth.hostId)
    .maybeSingle();
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await admin
    .from("marketing_campaign_send")
    .select("*, guest:guest_id(full_name, email, phone)")
    .eq("campaign_id", id)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sends: data ?? [] });
}
