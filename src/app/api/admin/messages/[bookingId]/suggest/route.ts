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
import { houseForProperty } from "@/lib/guest-messages/quick-replies";
import type { UpsellEntry } from "@/types/database";

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

  // When the guest spoke last there's a message to answer (reply mode). When the
  // host spoke last, don't error — draft a follow-up that continues the thread.
  const lastGuest = lastUnansweredGuestMessage(body.messages);
  const followUp = !lastGuest;
  const hash = lastGuest ? hashGuestMessage(lastGuest) : null;

  const admin = createAdminClient();
  const hasFeedback = !!body.feedback?.note?.trim();
  // House this conversation belongs to — scopes both stored rules and the
  // guidance loaded for generation (global rules + this house's rules).
  const house = houseForProperty(body.propertyName);

  // Cache hit only for plain reply requests — feedback and follow-ups (drafted
  // on demand, keyed on nothing stable) always regenerate.
  if (!hasFeedback && !followUp && Number.isFinite(bookingId)) {
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
      guest_message: (lastGuest ?? "(follow-up — host spoke last)").slice(0, 2000),
      bad_draft: body.feedback.badDraft?.slice(0, 4000) ?? null,
      note: body.feedback.note.trim().slice(0, 2000),
      // "house" scopes the rule to this home; "global" (default) leaves it null.
      house: body.feedback.scope === "house" ? house : null,
    });
  }

  // Attach paid add-ons (server-side truth) so drafts quote adjusted
  // check-in/checkout times instead of the standard schedule.
  if (Number.isFinite(bookingId)) {
    const { data: reg } = await admin
      .from("registration")
      .select("upsells")
      .eq("lodgify_booking_id", bookingId)
      .maybeSingle();
    const paid = ((reg?.upsells as UpsellEntry[] | null) ?? []).filter((u) => u.status === "paid");
    if (paid.length) {
      body.purchasedAddOns = paid.map((u) => u.label || u.type);
    }
  }

  try {
    const guidance = await loadGuidance(admin, house);
    const draft = await generateDraftReply(body, guidance, hasFeedback ? body.feedback : undefined, { followUp });
    // Only reply-mode drafts are cached (keyed on the guest's last message);
    // follow-ups have no stable key, so they're never stored.
    if (draft && !followUp && Number.isFinite(bookingId)) {
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
    // Surface the specific reason when Anthropic rejects for an unpaid balance,
    // so the host knows AI drafts are down because the Claude account needs
    // credits — not a random glitch to keep retrying.
    const msg = err instanceof Error ? err.message : String(err);
    const outOfCredits = /credit balance is too low|Plans & Billing/i.test(msg);
    return NextResponse.json(
      {
        draft: null,
        configured: true,
        reason: outOfCredits ? "billing" : "error",
        error: outOfCredits
          ? "AI drafts are paused: Anthropic (Claude) says this account's credit balance is too low. Add credits in the Anthropic console to turn drafting back on."
          : "Draft generation failed",
      },
      { status: 502 }
    );
  }
}
