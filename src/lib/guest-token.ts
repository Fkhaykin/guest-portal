import { createHmac, timingSafeEqual } from "crypto";

/**
 * Guest token: HMAC-SHA256 of the registration_id, keyed by a server secret.
 * Returned from /api/guest/lookup, required on all subsequent guest API calls
 * via the x-guest-token header.
 */

function getSecret(): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return secret;
}

export function signGuestToken(registrationId: string): string {
  return createHmac("sha256", getSecret())
    .update(registrationId)
    .digest("hex");
}

export function verifyGuestToken(
  registrationId: string,
  token: string
): boolean {
  const expected = signGuestToken(registrationId);
  if (expected.length !== token.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}
