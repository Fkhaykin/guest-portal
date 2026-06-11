import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  generateDraftReply,
  isDraftConfigured,
  hashGuestMessage,
  lastUnansweredGuestMessage,
  type DraftContext,
  type DraftFeedback,
} from "@/lib/guest-messages/suggest";
import { loadGuidance } from "@/lib/guest-messages/guidance";

export const maxDuration = 60;

interface SuggestBody extends DraftContext {
  /** Present when the host rejected the current draft ("Fix" flow): the bad
   * draft + what's wrong. Stored as a standing rule and applied immediately. */
  feedback?: DraftFeedback;
}

// POST /api/admin/messages/[bookingId]/suggest
// Body: { guestName, propertyName, arrival, departure, status, messages: [{type, text}], feedback? }
// Returns: { draft: string | null, configured: boolean, cached?: boolean }
// Drafts are cached in message_draft keyed by the last guest message, so
// backfilled/previously generated drafts return instantly. Feedback bypasses
// the cache, records a draft_feedback rule, and regenerates.
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

  let body: SuggestBody;
  try {
    body = (await request.json()) as SuggestBody;
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
  const hasFeedback = !!body.feedback?.note?.trim();

  // Cache hit only for plain requests — feedback always regenerates
  if (!hasFeedback && Number.isFinite(bookingId)) {
    const { data: cached } = await admin
      .from("message_draft")
      .select("draft, last_guest_message_hash")
      .eq("lodgify_booking_id", bookingId)
      .maybeSingle();
    if (cached && cached.last_guest_message_hash === hash) {
      return NextResponse.json({ draft: cached.draft, configured: true, cached: true });
    }
  }

  // Record explicit feedback as a standing rule BEFORE regenerating, so it
  // applies to this regeneration and every future draft.
  if (hasFeedback && body.feedback) {
    await admin.from("draft_feedback").insert({
      lodgify_booking_id: Number.isFinite(bookingId) ? bookingId : null,
      source: "explicit",
      guest_message: lastGuest.slice(0, 2000),
      bad_draft: body.feedback.badDraft?.slice(0, 4000) ?? null,
      note: body.feedback.note.trim().slice(0, 2000),
    });
  }

  try {
    const guidance = await loadGuidance(admin);
    const draft = await generateDraftReply(body, guidance, hasFeedback ? body.feedback : undefined);
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
