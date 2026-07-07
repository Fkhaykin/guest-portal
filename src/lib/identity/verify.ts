import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe/client";

/** Lowercase, accent-stripped alpha tokens for loose name comparison. */
function nameTokens(name: string): string[] {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Loose name match: every token of the ID's first AND last name must appear in
 * the booking name. Tolerates middle names, word order, and punctuation while
 * still flagging a genuinely different person for host review.
 */
export function namesMatch(
  bookingName: string,
  firstName?: string | null,
  lastName?: string | null,
): boolean {
  if (!firstName || !lastName) return false;
  const booking = new Set(nameTokens(bookingName));
  const first = nameTokens(firstName);
  const last = nameTokens(lastName);
  if (first.length === 0 || last.length === 0) return false;
  return first.every((t) => booking.has(t)) && last.every((t) => booking.has(t));
}

export type IdentityOutcome = "verified" | "requires_input" | "processing" | "canceled";

/**
 * Reconcile a Stripe Identity VerificationSession onto its registration.
 * Idempotent and safe to call from both the webhook and the client poll route:
 * only terminal outcomes (verified, or a failed submission) are persisted.
 *
 *  - verified                         → persist name + name-match flag
 *  - requires_input WITH last_error   → a failed submission; persist for retry
 *  - requires_input WITHOUT last_error→ user closed before submitting → canceled
 *  - processing                       → still running; caller keeps polling
 */
export async function finalizeIdentitySession(
  supabase: SupabaseClient,
  session: Stripe.Identity.VerificationSession,
): Promise<IdentityOutcome> {
  const registrationId = session.metadata?.registration_id;
  if (!registrationId) return "processing";

  if (session.status === "verified") {
    // Identity redacts verified_outputs from webhook payloads — retrieve fresh
    // with expand so we can read the extracted name.
    let outputs = session.verified_outputs;
    if (!outputs?.first_name) {
      const full = await stripe.identity.verificationSessions.retrieve(session.id, {
        expand: ["verified_outputs"],
      });
      outputs = full.verified_outputs;
    }
    const verifiedName =
      [outputs?.first_name, outputs?.last_name].filter(Boolean).join(" ") || null;

    const { data: reg } = await supabase
      .from("registration")
      .select("guest:guest_id(full_name)")
      .eq("id", registrationId)
      .single();
    const bookingName =
      (reg as { guest?: { full_name?: string | null } } | null)?.guest?.full_name ?? "";
    const match = namesMatch(bookingName, outputs?.first_name, outputs?.last_name);

    await supabase
      .from("registration")
      .update({
        id_verification_status: "verified",
        id_verification_session_id: session.id,
        id_verified_name: verifiedName,
        id_name_match: match,
        id_verified_at: new Date().toISOString(),
      })
      .eq("id", registrationId);
    return "verified";
  }

  if (session.status === "requires_input" && session.last_error) {
    await supabase
      .from("registration")
      .update({
        id_verification_status: "requires_input",
        id_verification_session_id: session.id,
      })
      .eq("id", registrationId);
    return "requires_input";
  }

  // requires_input with no error = closed before submitting; canceled = abandoned.
  if (session.status === "requires_input" || session.status === "canceled") {
    return "canceled";
  }

  return "processing";
}
