// Sentiment gate for the post-checkout review request: skip asking for a
// review when the conversation shows the guest had problems we didn't clearly
// resolve, or they're upset. Fails open (send) — most stays have no negative
// signal, and a transient API error shouldn't silently kill review volume.
import Anthropic from "@anthropic-ai/sdk";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_MESSAGES = 40;

export type ReviewGateResult = {
  send: boolean;
  reason: string;
};

/**
 * Decide whether it's appropriate to send a review request for this booking,
 * based on the guest-message thread. No thread → send (no negative signal).
 * Lodgify/OTA messages carry lodgify_booking_id; web-chat and direct
 * email/SMS messages carry registration_id — match on either so direct
 * guests' conversations aren't invisible to the gate.
 */
export async function shouldRequestReview(
  lodgifyBookingId: number | null,
  registrationId?: string | null
): Promise<ReviewGateResult> {
  if (!lodgifyBookingId && !registrationId) {
    return { send: true, reason: "no booking thread" };
  }

  const filters = [
    ...(lodgifyBookingId ? [`lodgify_booking_id.eq.${lodgifyBookingId}`] : []),
    ...(registrationId ? [`registration_id.eq.${registrationId}`] : []),
  ];
  const supabase = createAdminClient();
  const { data: messages } = await supabase
    .from("guest_message")
    .select("message_type, message, creation_time")
    .or(filters.join(","))
    .order("creation_time", { ascending: true })
    .limit(MAX_MESSAGES);

  const guestMessages = (messages ?? []).filter((m) => m.message_type === "Renter");
  if (guestMessages.length === 0) {
    return { send: true, reason: "no guest messages" };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return { send: true, reason: "sentiment check unavailable" };
  }

  const transcript = (messages ?? [])
    .map((m) => `${m.message_type === "Renter" ? "GUEST" : "HOST"}: ${(m.message ?? "").slice(0, 500)}`)
    .join("\n\n");

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 16,
      system:
        "You screen vacation-rental conversations to decide if it's appropriate to send the guest an automated review request after checkout. " +
        "Answer SKIP if the guest seems upset, disappointed, or angry; had significant unresolved problems (broken amenities, cleanliness complaints, access issues that ruined time); threatened bad reviews or refunds; or the host issued an apology/refund for a major issue. " +
        "Answer SEND otherwise — including for neutral logistics chatter, resolved minor issues the guest seemed satisfied about, and positive conversations. " +
        "Respond with exactly one word: SEND or SKIP.",
      messages: [{ role: "user", content: `Conversation (oldest first):\n\n${transcript}` }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim()
      .toUpperCase();

    if (text.includes("SKIP")) {
      return { send: false, reason: "negative sentiment detected" };
    }
    return { send: true, reason: "sentiment ok" };
  } catch (err) {
    console.error(`[review-gate] Sentiment check failed for booking ${lodgifyBookingId}:`, err);
    return { send: true, reason: "sentiment check errored" };
  }
}

// Minimum gap between per-booking evaluations. Collapses Lodgify's 2-3x
// webhook bursts (and rapid-fire guest messages) into one LLM call; the
// evaluation reads the whole thread, so the surviving call sees every message
// that arrived before it ran.
const RECHECK_INTERVAL_MS = 3 * 60_000;

/**
 * Re-run the review-request gate for a booking when a new guest message
 * arrives, and record the verdict on the registration — so the reservation
 * page can show a planned skip while the guest is still mid-stay instead of
 * only after the post-checkout cron. A later evaluation that comes back
 * positive clears the flag (problems can get resolved); the morning-after-
 * checkout cron still makes the final call.
 */
export async function refreshReviewSentiment(opts: {
  registrationId?: string | null;
  lodgifyBookingId?: number | null;
}): Promise<void> {
  const supabase = createAdminClient();

  let query = supabase
    .from("registration")
    .select("id, lodgify_booking_id, status, check_out_date, review_request_disabled")
    .limit(1);
  if (opts.registrationId) query = query.eq("id", opts.registrationId);
  else if (opts.lodgifyBookingId) query = query.eq("lodgify_booking_id", opts.lodgifyBookingId);
  else return;

  const { data: regs } = await query;
  const reg = regs?.[0];
  if (!reg || reg.status === "cancelled" || reg.review_request_disabled) return;

  // Once the morning-after-checkout cron has made the final send/skip call, a
  // late message must not rewrite (or clear) that historical record.
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  if (reg.check_out_date < yesterday) return;

  // Atomic throttle claim: of N concurrent callers, the conditional update
  // succeeds for exactly one (Postgres re-checks the WHERE under the row lock).
  const now = new Date();
  const cutoff = new Date(now.getTime() - RECHECK_INTERVAL_MS).toISOString();
  const { data: claimed } = await supabase
    .from("registration")
    .update({ review_sentiment_checked_at: now.toISOString() })
    .eq("id", reg.id)
    .or(`review_sentiment_checked_at.is.null,review_sentiment_checked_at.lt.${cutoff}`)
    .select("id");
  if (!claimed || claimed.length === 0) return;

  const gate = await shouldRequestReview(reg.lodgify_booking_id, reg.id);
  await supabase
    .from("registration")
    .update(
      gate.send
        ? { review_request_skipped_at: null, review_request_skip_reason: null }
        : { review_request_skipped_at: now.toISOString(), review_request_skip_reason: gate.reason }
    )
    .eq("id", reg.id);
}

/**
 * Fire refreshReviewSentiment without delaying the caller's response: inside
 * a request scope it runs via next/server's after() once the response is
 * sent; outside one (cron, scripts) it falls back to fire-and-forget.
 */
export function scheduleSentimentRefresh(opts: {
  registrationId?: string | null;
  lodgifyBookingId?: number | null;
}): void {
  const run = () =>
    refreshReviewSentiment(opts).catch((err) =>
      console.error("[review-gate] Sentiment refresh failed:", err)
    );
  try {
    after(run);
  } catch {
    void run();
  }
}
