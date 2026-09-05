import { createAdminClient } from "@/lib/supabase/admin";
import { deliverSms } from "@/lib/sms/client";

// Sends an SMS (via the configured provider) and records the attempt in sms_log.
// Shared by the registration reminders and the core automated guest messages
// (booking confirmation, check-in instructions). Never throws — returns the
// outcome so callers can fold it into their own per-message log.
export async function sendGuestSms(
  to: string,
  message: string,
  meta: { eventType: string; lodgifyBookingId: number | null; registrationId: string }
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();

  // Note: these automated messages intentionally don't attach a reply webhook,
  // matching prior behavior. Two-way replies run through the direct-message path.
  const result = await deliverSms(to, message);

  await supabase.from("sms_log").insert({
    recipient_phone: to,
    recipient_name: null,
    message,
    event_type: meta.eventType,
    lodgify_booking_id: meta.lodgifyBookingId,
    property_id: null,
    success: result.success,
    error: result.error ?? null,
    quota_remaining: result.quotaRemaining ?? null,
  });

  return { success: result.success, error: result.error };
}
