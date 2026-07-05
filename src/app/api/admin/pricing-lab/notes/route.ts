import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// POST /api/admin/pricing-lab/notes { nickname, body }
export async function POST(request: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { nickname: string; body: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.nickname || !body.body?.trim()) {
    return NextResponse.json({ error: "nickname and body required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("pricing_note")
    .insert({ nickname: body.nickname, body: body.body.trim(), created_by: user.id })
    .select("id, body, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ note: data });
}

// DELETE /api/admin/pricing-lab/notes?id=<uuid>
export async function DELETE(request: NextRequest) {
  if (!(await requireUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const admin = createAdminClient();
  const { error } = await admin.from("pricing_note").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
