import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireHost } from "@/lib/marketing/auth";

export async function GET() {
  const auth = await requireHost();
  if ("error" in auth) return auth.error;

  const admin = createAdminClient();
  const { data } = await admin
    .from("host")
    .select("marketing_send_cap_days, marketing_from_email, marketing_from_name")
    .eq("id", auth.hostId)
    .single();

  return NextResponse.json({
    marketing_send_cap_days: data?.marketing_send_cap_days ?? 14,
    marketing_from_email: data?.marketing_from_email ?? null,
    marketing_from_name: data?.marketing_from_name ?? null,
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireHost();
  if ("error" in auth) return auth.error;

  const body = (await request.json()) as {
    marketing_send_cap_days?: number;
    marketing_from_email?: string | null;
    marketing_from_name?: string | null;
  };

  const updates: Record<string, unknown> = {};
  if (body.marketing_send_cap_days !== undefined) {
    if (body.marketing_send_cap_days < 0 || body.marketing_send_cap_days > 365) {
      return NextResponse.json({ error: "cap_days must be 0-365" }, { status: 400 });
    }
    updates.marketing_send_cap_days = body.marketing_send_cap_days;
  }
  if (body.marketing_from_email !== undefined) updates.marketing_from_email = body.marketing_from_email;
  if (body.marketing_from_name !== undefined) updates.marketing_from_name = body.marketing_from_name;

  const admin = createAdminClient();
  const { error } = await admin.from("host").update(updates).eq("id", auth.hostId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
