import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateDraftReply, isDraftConfigured, type DraftContext } from "@/lib/guest-messages/suggest";

export const maxDuration = 60;

// POST /api/admin/messages/[bookingId]/suggest
// Body: { guestName, propertyName, arrival, departure, status, messages: [{type, text}] }
// Returns: { draft: string | null, configured: boolean }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await params; // bookingId only namespaces the route; context comes from the body

  if (!isDraftConfigured()) {
    return NextResponse.json({ draft: null, configured: false });
  }

  let body: DraftContext;
  try {
    body = (await request.json()) as DraftContext;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  try {
    const draft = await generateDraftReply(body);
    return NextResponse.json({ draft, configured: true });
  } catch (err) {
    console.error("[suggest] Draft generation failed:", err);
    return NextResponse.json({ draft: null, configured: true, error: "Draft generation failed" }, { status: 502 });
  }
}
