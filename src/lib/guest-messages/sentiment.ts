// Sentiment gate for the post-checkout review request: skip asking for a
// review when the conversation shows the guest had problems we didn't clearly
// resolve, or they're upset. Fails open (send) — most stays have no negative
// signal, and a transient API error shouldn't silently kill review volume.
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_MESSAGES = 40;

export type ReviewGateResult = {
  send: boolean;
  reason: string;
};

/**
 * Decide whether it's appropriate to send a review request for this booking,
 * based on the guest-message thread. No thread → send (no negative signal).
 */
export async function shouldRequestReview(
  lodgifyBookingId: number | null
): Promise<ReviewGateResult> {
  if (!lodgifyBookingId) return { send: true, reason: "no booking thread" };

  const supabase = createAdminClient();
  const { data: messages } = await supabase
    .from("guest_message")
    .select("message_type, message, creation_time")
    .eq("lodgify_booking_id", lodgifyBookingId)
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
