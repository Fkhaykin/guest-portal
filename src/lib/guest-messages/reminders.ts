import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMessage } from "@/lib/lodgify/messages";
import { TEMPLATES, PORTAL_URL, interpolate, firstNameOf, isDirectBookingSource, type TemplateVars } from "./templates";
import { claimMessageSlot } from "./send";
import { stayTimeVars } from "@/lib/upsells/timing";
import { stripUrlsForSms } from "@/lib/sms/sanitize";
import { sendGuestSms } from "@/lib/sms/send-guest-sms";
import type { GuestMessageSettings, UpsellEntry } from "@/types/database";

export const REMINDER_DAYS = [10, 7, 6, 5, 4, 3, 2, 1] as const;
export type ReminderDay = (typeof REMINDER_DAYS)[number];

interface SendReminderParams {
  registrationId: string;
  lodgifyBookingId: number | null;
  daysUntilCheckin: ReminderDay;
  bookingSource: string | null;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  propertyName: string;
  propertySlug: string;
  checkInDate: string;
  checkOutDate: string;
  hostId: string;
  upsells?: UpsellEntry[] | null;
}

async function getHostSettings(hostId: string): Promise<GuestMessageSettings | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("host")
    .select("guest_message_settings")
    .eq("id", hostId)
    .single();
  return (data?.guest_message_settings as GuestMessageSettings | null) ?? null;
}

export async function sendRegistrationReminder(params: SendReminderParams): Promise<"sent" | "skipped" | "duplicate"> {
  const supabase = createAdminClient();
  const messageTypeKey = `registration_reminder_d${params.daysUntilCheckin}`;

  const { data: existing } = await supabase
    .from("guest_automated_message_log")
    .select("id")
    .eq("registration_id", params.registrationId)
    .eq("message_type", messageTypeKey)
    .maybeSingle();
  if (existing) return "duplicate";

  const hostSettings = await getHostSettings(params.hostId);
  const eventSettings = hostSettings?.registration_reminder;
  if (eventSettings && eventSettings.enabled === false) return "skipped";

  const vars: TemplateVars = {
    guest_name: firstNameOf(params.guestName),
    property_name: params.propertyName,
    check_in_date: params.checkInDate,
    check_out_date: params.checkOutDate,
    ...stayTimeVars(params.upsells),
    portal_link: PORTAL_URL,
  };

  const defaults = TEMPLATES.registration_reminder;
  const subject = interpolate(eventSettings?.subject ?? defaults.subject, vars);
  const body = interpolate(eventSettings?.message ?? defaults.body, vars);

  // Atomically claim before sending so concurrent runs can't each fire this
  // reminder (see claimMessageSlot in ./send). Released below if we end up with
  // nothing to send, so a later run with a usable channel can still claim it.
  const claimedId = await claimMessageSlot(supabase, params.registrationId, messageTypeKey);
  if (!claimedId) return "duplicate";

  const isDirect = isDirectBookingSource(params.bookingSource);

  const channelsAttempted: string[] = [];
  const errors: string[] = [];

  if (isDirect) {
    if (params.guestEmail) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const { error } = await resend.emails.send({
          from: "Summit Lakeside <contact@summitlakeside.com>",
          to: params.guestEmail,
          subject,
          text: body,
        });
        channelsAttempted.push("email");
        if (error) errors.push(`email: ${error.message}`);
      } catch (err) {
        channelsAttempted.push("email");
        errors.push(`email: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }
  } else if (params.lodgifyBookingId) {
    // OTA bookings (Airbnb, Vrbo, Booking.com…) get the reminder — with its
    // live registration link — on the Lodgify thread, the same channel every
    // other guest message already uses for them. Airbnb guests frequently have
    // no email on file, so without this the link only ever reached them by SMS,
    // where it's stripped until Textbelt whitelists links (see below).
    const result = await sendMessage(params.lodgifyBookingId, body);
    channelsAttempted.push("lodgify");
    if (!result.success) errors.push(`lodgify: ${result.error ?? "unknown"}`);
  }

  if (params.guestPhone) {
    // SMS can't carry the link until Textbelt whitelists the key (see
    // sms/sanitize), so the text nudges the guest to reply — which reaches the
    // host via the inbound SMS webhook. The live link itself goes out on the
    // guest's primary channel above (email for direct, Lodgify thread for OTA).
    const smsBody = stripUrlsForSms(
      body,
      "(reply to this text and we'll send you the registration link)"
    );
    const smsResult = await sendGuestSms(params.guestPhone, smsBody, {
      eventType: messageTypeKey,
      lodgifyBookingId: params.lodgifyBookingId,
      registrationId: params.registrationId,
    });
    channelsAttempted.push("sms");
    if (!smsResult.success) errors.push(`sms: ${smsResult.error ?? "unknown"}`);
  }

  if (channelsAttempted.length === 0) {
    // Nothing to send (e.g. Airbnb with no phone) — release the claim so a
    // future run isn't blocked from sending if a channel becomes available.
    await supabase.from("guest_automated_message_log").delete().eq("id", claimedId);
    return "skipped";
  }

  await supabase
    .from("guest_automated_message_log")
    .update({
      channel: channelsAttempted.join(","),
      error: errors.length > 0 ? errors.join("; ") : null,
    })
    .eq("id", claimedId);

  if (errors.length > 0) {
    console.error(`[reminder] ${messageTypeKey} for ${params.registrationId}: ${errors.join("; ")}`);
  }

  return "sent";
}
