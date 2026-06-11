import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  generateDraftReply,
  isDraftConfigured,
  hashGuestMessage,
  lastUnansweredGuestMessage,
  type DraftContext,
} from "@/lib/guest-messages/suggest";

export const maxDuration = 60;

// POST /api/admin/messages/[bookingId]/suggest
// Body: { guestName, propertyName, arrival, departure, status, messages: [{type, text}] }
// Returns: { draft: string | null, configured: boolean, cached?: boolean }
// Drafts are cached in message_draft keyed by the last guest message, so
// backfilled/previously generated drafts return instantly.
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

  const { bookingId: bookingIdParam } = await params;
  const bookingId = Number(bookingIdParam);

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

  const lastGuest = lastUnansweredGuestMessage(body.messages);
  if (!lastGuest) {
    return NextResponse.json({ draft: null, configured: true });
  }
  const hash = hashGuestMessage(lastGuest);

  const admin = createAdminClient();

  if (Number.isFinite(bookingId)) {
    const { data: cached } = await admin
      .from("message_draft")
      .select("draft, last_guest_message_hash")
      .eq("lodgify_booking_id", bookingId)
      .maybeSingle();
    if (cached && cached.last_guest_message_hash === hash) {
      return NextResponse.json({ draft: cached.draft, configured: true, cached: true });
    }
  }

  try {
    const draft = await generateDraftReply(body);
    if (draft && Number.isFinite(bookingId)) {
      await admin.from("message_draft").upsert(
        {
          lodgify_booking_id: bookingId,
          draft,
          last_guest_message_hash: hash,
          generated_at: new Date().toISOString(),
        },
        { onConflict: "lodgify_booking_id" }
      );
    }
    return NextResponse.json({ draft, configured: true });
  } catch (err) {
    console.error("[suggest] Draft generation failed:", err);
    return NextResponse.json({ draft: null, configured: true, error: "Draft generation failed" }, { status: 502 });
  }
}
