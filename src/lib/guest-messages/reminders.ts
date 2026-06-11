import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMessage } from "@/lib/lodgify/messages";
import { TEMPLATES, interpolate, type TemplateVars } from "./templates";
import { stayTimeVars } from "@/lib/upsells/timing";
import type { GuestMessageSettings, UpsellEntry } from "@/types/database";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://guest.summitlakeside.com";
const TEXTBELT_KEY = process.env.TEXTBELT_API_KEY?.trim();

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

async function sendGuestSms(
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
    guest_name: params.guestName,
    property_name: params.propertyName,
    check_in_date: params.checkInDate,
    check_out_date: params.checkOutDate,
    ...stayTimeVars(params.upsells),
    portal_link: `${APP_URL}/p/${params.propertySlug}/register`,
  };

  const defaults = TEMPLATES.registration_reminder;
  const subject = interpolate(eventSettings?.subject ?? defaults.subject, vars);
  const body = interpolate(eventSettings?.message ?? defaults.body, vars);

  const isAirbnb = !!params.bookingSource && /airbnb/i.test(params.bookingSource);
  const isDirect = !params.bookingSource || /direct|lodgify/i.test(params.bookingSource);

  const channelsAttempted: string[] = [];
  const errors: string[] = [];

  if (!isAirbnb) {
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
      const result = await sendMessage(params.lodgifyBookingId, body);
      channelsAttempted.push("lodgify");
      if (!result.success) errors.push(`lodgify: ${result.error ?? "unknown"}`);
    }
  }

  if (params.guestPhone) {
    const smsResult = await sendGuestSms(params.guestPhone, body, {
      eventType: messageTypeKey,
      lodgifyBookingId: params.lodgifyBookingId,
      registrationId: params.registrationId,
    });
    channelsAttempted.push("sms");
    if (!smsResult.success) errors.push(`sms: ${smsResult.error ?? "unknown"}`);
  }

  if (channelsAttempted.length === 0) return "skipped";

  await supabase.from("guest_automated_message_log").insert({
    registration_id: params.registrationId,
    message_type: messageTypeKey,
    channel: channelsAttempted.join(","),
    error: errors.length > 0 ? errors.join("; ") : null,
  });

  if (errors.length > 0) {
    console.error(`[reminder] ${messageTypeKey} for ${params.registrationId}: ${errors.join("; ")}`);
  }

  return "sent";
}
