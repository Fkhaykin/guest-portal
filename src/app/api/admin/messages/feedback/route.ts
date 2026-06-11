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

// GET /api/admin/messages/feedback — list active training rules & edit pairs
export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("draft_feedback")
    .select("id, source, note, bad_draft, corrected_draft, guest_message, lodgify_booking_id, created_at")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ feedback: data ?? [] });
}

// POST /api/admin/messages/feedback
// Body: { source: "manual", note } — add a training rule directly, or
//       { source: "edit", bookingId?, guestMessage?, badDraft, correctedDraft } —
//       implicit capture when the host edits a draft before sending.
export async function POST(request: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    source?: string;
    note?: string;
    bookingId?: number;
    guestMessage?: string;
    badDraft?: string;
    correctedDraft?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const admin = createAdminClient();

  if (body.source === "manual") {
    if (!body.note?.trim()) {
      return NextResponse.json({ error: "note required" }, { status: 400 });
    }
    const { data, error } = await admin
      .from("draft_feedback")
      .insert({ source: "manual", note: body.note.trim().slice(0, 2000) })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ id: data.id });
  }

  if (body.source === "edit") {
    if (!body.badDraft?.trim() || !body.correctedDraft?.trim()) {
      return NextResponse.json({ error: "badDraft and correctedDraft required" }, { status: 400 });
    }
    const { data, error } = await admin
      .from("draft_feedback")
      .insert({
        source: "edit",
        lodgify_booking_id: body.bookingId ?? null,
        guest_message: body.guestMessage?.slice(0, 2000) ?? null,
        bad_draft: body.badDraft.slice(0, 4000),
        corrected_draft: body.correctedDraft.slice(0, 4000),
      })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ id: data.id });
  }

  return NextResponse.json({ error: "unsupported source" }, { status: 400 });
}

// DELETE /api/admin/messages/feedback?id=<uuid> — deactivate a rule
export async function DELETE(request: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from("draft_feedback").update({ active: false }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
