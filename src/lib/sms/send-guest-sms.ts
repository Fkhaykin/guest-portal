import { createAdminClient } from "@/lib/supabase/admin";

const TEXTBELT_KEY = process.env.TEXTBELT_API_KEY?.trim();

// Sends an SMS via Textbelt and records the attempt in sms_log. Shared by the
// registration reminders and the core automated guest messages (booking
// confirmation, check-in instructions). Never throws — returns the outcome so
// callers can fold it into their own per-message log.
export async function sendGuestSms(
  to: string,
  message: string,
  meta: { eventType: string; lodgifyBookingId: number | null; registrationId: string }
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();

  if (!TEXTBELT_KEY) {
    await supabase.from("sms_log").insert({
      recipient_phone: to,
      recipient_name: null,
      message,
      event_type: meta.eventType,
      lodgify_booking_id: meta.lodgifyBookingId,
      property_id: null,
      success: false,
      error: "TEXTBELT_API_KEY not configured",
    });
    return { success: false, error: "TEXTBELT_API_KEY not configured" };
  }

  const res = await fetch("https://textbelt.com/text", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: to, message, key: TEXTBELT_KEY }),
  });
  const data = await res.json();

  await supabase.from("sms_log").insert({
    recipient_phone: to,
    recipient_name: null,
    message,
    event_type: meta.eventType,
    lodgify_booking_id: meta.lodgifyBookingId,
    property_id: null,
    success: data.success === true,
    error: data.error ?? null,
    quota_remaining: typeof data.quotaRemaining === "number" ? data.quotaRemaining : null,
  });

  return { success: data.success === true, error: data.error };
}
