import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { HOUSE_KEYS, type HouseKey } from "@/lib/guest-messages/quick-replies";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

const REPLY_COLUMNS = "id, title, body, category, house, created_at";

function parseHouse(value: unknown): HouseKey | null {
  return typeof value === "string" && (HOUSE_KEYS as readonly string[]).includes(value)
    ? (value as HouseKey)
    : null;
}

// GET /api/admin/quick-replies — list the host's saved quick replies
export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("custom_quick_reply")
    .select(REPLY_COLUMNS)
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ replies: data ?? [] });
}

// POST /api/admin/quick-replies
// Body: { title, body, category?, house? } — house null/omitted = all homes.
export async function POST(request: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { title?: string; body?: string; category?: string; house?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.title?.trim() || !body.body?.trim()) {
    return NextResponse.json({ error: "title and body required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("custom_quick_reply")
    .insert({
      title: body.title.trim().slice(0, 120),
      body: body.body.trim().slice(0, 4000),
      category: body.category?.trim().slice(0, 60) || "My Replies",
      house: parseHouse(body.house),
    })
    .select(REPLY_COLUMNS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reply: data });
}

// PATCH /api/admin/quick-replies
// Body: { id, title?, body?, category?, house? } — house accepts null to
// widen a house reply to all homes.
export async function PATCH(request: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    id?: string;
    title?: string;
    body?: string;
    category?: string;
    house?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const updates: Record<string, string | null> = {};
  if (body.title !== undefined) {
    if (!body.title.trim()) return NextResponse.json({ error: "title required" }, { status: 400 });
    updates.title = body.title.trim().slice(0, 120);
  }
  if (body.body !== undefined) {
    if (!body.body.trim()) return NextResponse.json({ error: "body required" }, { status: 400 });
    updates.body = body.body.trim().slice(0, 4000);
  }
  if (body.category !== undefined) {
    updates.category = body.category?.trim().slice(0, 60) || "My Replies";
  }
  if (body.house !== undefined) {
    updates.house = parseHouse(body.house);
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("custom_quick_reply")
    .update(updates)
    .eq("id", body.id)
    .select(REPLY_COLUMNS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reply: data });
}

// DELETE /api/admin/quick-replies?id=<uuid> — soft delete
export async function DELETE(request: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin
    .from("custom_quick_reply")
    .update({ active: false })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
