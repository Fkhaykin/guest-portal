import { createAdminClient } from "@/lib/supabase/admin";
import { notifyHostOfNewBooking } from "@/lib/push/notify-host";
import { notifyCleanersOfNewBooking } from "@/lib/sms/notify-cleaners";

/**
 * Backstop for new-booking alerts. The inline notify (in syncBooking) can be
 * killed mid-send by a Lodgify webhook burst freezing the serverless instance,
 * which leaves the alert un-delivered. This sweep finds recent active bookings
 * whose host and/or cleaner new-booking alert never confirmed as 'sent' in
 * booking_notification and re-sends the missing side. The notify functions
 * self-dedup via the claim, so this is safe to run often and concurrently.
 *
 * Runs from booking webhooks (near-real-time healing on the next booking) and
 * the daily guest-message crons (a floor for quiet periods).
 */
export async function reconcileBookingAlerts(opts?: {
  withinHours?: number;
  limit?: number;
}): Promise<{ checked: number; resent: number }> {
  const supabase = createAdminClient();
  const withinHours = opts?.withinHours ?? 24;
  const since = new Date(Date.now() - withinHours * 3_600_000).toISOString();

  const { data: regs } = await supabase
    .from("registration")
    .select(
      "id, property_id, check_in_date, check_out_date, num_guests, lodgify_infants, lodgify_num_pets, notes, upsells, guest:guest_id(full_name)"
    )
    .eq("status", "active")
    .gte("created_at", since)
    .not("property_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 200);

  if (!regs?.length) return { checked: 0, resent: 0 };

  // Which (registration, channel) new-booking alerts already confirmed delivered.
  const { data: sentRows } = await supabase
    .from("booking_notification")
    .select("registration_id, channel")
    .in("registration_id", regs.map((r) => r.id))
    .eq("event_type", "new_booking")
    .eq("status", "sent");
  const delivered = new Set((sentRows ?? []).map((n) => `${n.registration_id}:${n.channel}`));

  let resent = 0;
  for (const r of regs) {
    // Supabase types a to-one embed as an array; normalize.
    const guest = Array.isArray(r.guest) ? r.guest[0] : r.guest;
    const guestName = (guest as { full_name?: string } | null)?.full_name ?? "Guest";
    if (!r.check_in_date || !r.check_out_date) continue;

    const base = {
      propertyId: r.property_id as string,
      registrationId: r.id as string,
      guestName,
      checkIn: r.check_in_date as string,
      checkOut: r.check_out_date as string,
      numGuests: (r.num_guests as number) ?? 1,
    };

    if (!delivered.has(`${r.id}:host`)) {
      await notifyHostOfNewBooking(base).catch((err) =>
        console.error(`[reconcile] host alert re-send failed for ${r.id}:`, err)
      );
      resent++;
    }

    if (!delivered.has(`${r.id}:cleaner`)) {
      const paidUpsells = ((r.upsells as Array<{ status: string; label?: string }> | null) ?? [])
        .filter((u) => u.status === "paid" && u.label)
        .map((u) => u.label!);
      await notifyCleanersOfNewBooking({
        ...base,
        numInfants: (r.lodgify_infants as number) ?? 0,
        numPets: (r.lodgify_num_pets as number) ?? 0,
        notes: (r.notes as string | null) ?? null,
        upsells: paidUpsells,
      }).catch((err) => console.error(`[reconcile] cleaner alert re-send failed for ${r.id}:`, err));
      resent++;
    }
  }

  return { checked: regs.length, resent };
}
