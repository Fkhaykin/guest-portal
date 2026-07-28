import { createAdminClient } from "@/lib/supabase/admin";

/** Which side of a new-booking alert a claim covers. */
export type AlertChannel = "host" | "cleaner";

/**
 * Atomically claim the new-booking alert slot for (registration, channel).
 * Returns true when this caller should send — of N concurrent Lodgify burst
 * deliveries exactly one wins. A killed/failed previous attempt (claimed but
 * never confirmed) becomes re-claimable after the stale window so the backstop
 * can retry it. Fails OPEN: a missed alert is worse than a rare duplicate.
 */
export async function claimBookingAlert(
  registrationId: string,
  channel: AlertChannel,
  eventType = "new_booking"
): Promise<boolean> {
  if (!registrationId) return true; // untracked caller — send best-effort
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("claim_booking_notification", {
    p_registration_id: registrationId,
    p_channel: channel,
    p_event_type: eventType,
  });
  if (error) {
    console.error(`[booking-alert] claim failed for ${registrationId}/${channel}:`, error.message);
    return true; // fail open
  }
  return data !== false;
}

/** Mark a claimed alert as actually delivered so the backstop skips it. */
export async function confirmBookingAlert(
  registrationId: string,
  channel: AlertChannel,
  eventType = "new_booking"
): Promise<void> {
  if (!registrationId) return;
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("booking_notification")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("registration_id", registrationId)
    .eq("channel", channel)
    .eq("event_type", eventType);
  if (error) console.error(`[booking-alert] confirm failed for ${registrationId}/${channel}:`, error.message);
}

/**
 * Release a claim whose send did not go through, so it can be retried instead
 * of masquerading as delivered. Only deletes a still-'claimed' row — never one
 * a concurrent caller already confirmed as 'sent'.
 */
export async function releaseBookingAlert(
  registrationId: string,
  channel: AlertChannel,
  eventType = "new_booking"
): Promise<void> {
  if (!registrationId) return;
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("booking_notification")
    .delete()
    .eq("registration_id", registrationId)
    .eq("channel", channel)
    .eq("event_type", eventType)
    .eq("status", "claimed");
  if (error) console.error(`[booking-alert] release failed for ${registrationId}/${channel}:`, error.message);
}
