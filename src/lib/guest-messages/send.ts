import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMessage } from "@/lib/lodgify/messages";
import { TEMPLATES, PORTAL_URL, interpolate, firstNameOf, registrationCta, type GuestMessageType, type GuestMessageChannel, type TemplateVars } from "./templates";
import { HOUSE_CHECKIN_TEMPLATES, HOUSE_CHECKIN_SUBJECT } from "./house-templates";
import { houseForProperty } from "./quick-replies";
import { stayTimeVars } from "@/lib/upsells/timing";
import type { GuestMessageSettings, UpsellEntry } from "@/types/database";

interface SendParams {
  registrationId: string;
  lodgifyBookingId: number;
  messageType: GuestMessageType;
  channel: GuestMessageChannel;
  guestName: string;
  guestEmail: string | null;
  propertyName: string;
  propertySlug: string;
  checkInDate: string;
  checkOutDate: string;
  hostId: string;
  upsells?: UpsellEntry[] | null;
  /** Whether the guest has completed registration (signed). Drives the
   *  registration prompt instead of hedged "if you haven't" wording. */
  registered: boolean;
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

export async function sendGuestAutomatedMessage(params: SendParams): Promise<void> {
  const supabase = createAdminClient();

  // Dedup: skip if already sent for this registration + message type
  const { data: existing } = await supabase
    .from("guest_automated_message_log")
    .select("id")
    .eq("registration_id", params.registrationId)
    .eq("message_type", params.messageType)
    .maybeSingle();

  if (existing) return;

  // Load host settings; fall back to hardcoded defaults if not configured
  const hostSettings = await getHostSettings(params.hostId);
  const eventSettings = hostSettings?.[params.messageType];

  // Respect the enabled toggle — skip silently (no log entry)
  if (eventSettings && eventSettings.enabled === false) return;

  const vars: TemplateVars = {
    guest_name: firstNameOf(params.guestName),
    property_name: params.propertyName,
    check_in_date: params.checkInDate,
    check_out_date: params.checkOutDate,
    ...stayTimeVars(params.upsells),
    portal_link: PORTAL_URL,
    registration_cta: registrationCta(params.messageType, params.registered, PORTAL_URL),
  };

  const defaults = TEMPLATES[params.messageType];
  const subject = interpolate(eventSettings?.subject ?? defaults.subject, vars);
  const body = interpolate(eventSettings?.message ?? defaults.body, vars);

  let error: string | null = null;

  if (params.channel === "lodgify") {
    const result = await sendMessage(params.lodgifyBookingId, body);
    if (!result.success) error = result.error ?? "Unknown Lodgify error";
  } else {
    if (!params.guestEmail) {
      error = "No guest email on file";
    } else {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { error: resendError } = await resend.emails.send({
        from: "Summit Lakeside <contact@summitlakeside.com>",
        to: params.guestEmail,
        subject,
        text: body,
      });
      if (resendError) error = resendError.message;
    }
  }

  await supabase.from("guest_automated_message_log").insert({
    registration_id: params.registrationId,
    message_type: params.messageType,
    channel: params.channel,
    error,
  });

  if (error) {
    console.error(`[guest-msg] ${params.messageType} failed for registration ${params.registrationId}:`, error);
  }
}

// House-specific check-in instructions — the single check-in-morning message
// for a known house (it already opens with the dates/times, so it replaces the
// generic day_of_checkin rather than being sent alongside it). Template
// resolved per house (nickname or listing name), with per-house overrides from
// guest_message_settings.house_checkin_instructions.
//
// Returns true when the check-in message has been handled (sent, errored, or
// already sent on a prior run) so the caller skips day_of_checkin; returns
// false when there's nothing house-specific to send (unknown house or the host
// disabled house instructions) so the caller falls back to day_of_checkin.
export async function sendHouseCheckinInstructions(params: SendParams): Promise<boolean> {
  const house = houseForProperty(params.propertyName);
  if (!house) return false; // unknown house (e.g. Edison NJ) — fall back to day_of_checkin

  const supabase = createAdminClient();
  const messageTypeKey = `house_checkin_${house}`;

  const { data: existing } = await supabase
    .from("guest_automated_message_log")
    .select("id")
    .eq("registration_id", params.registrationId)
    .eq("message_type", messageTypeKey)
    .maybeSingle();
  if (existing) return true; // already sent this check-in's instructions

  const hostSettings = await getHostSettings(params.hostId);
  const eventSettings = hostSettings?.house_checkin_instructions?.[house];
  if (eventSettings && eventSettings.enabled === false) return false; // opted out → day_of_checkin

  const vars: TemplateVars = {
    guest_name: firstNameOf(params.guestName),
    property_name: params.propertyName,
    check_in_date: params.checkInDate,
    check_out_date: params.checkOutDate,
    ...stayTimeVars(params.upsells),
    portal_link: PORTAL_URL,
  };

  const subject = interpolate(eventSettings?.subject ?? HOUSE_CHECKIN_SUBJECT, vars);
  const body = interpolate(eventSettings?.message ?? HOUSE_CHECKIN_TEMPLATES[house], vars);

  let error: string | null = null;

  if (params.channel === "lodgify") {
    const result = await sendMessage(params.lodgifyBookingId, body);
    if (!result.success) error = result.error ?? "Unknown Lodgify error";
  } else {
    if (!params.guestEmail) {
      error = "No guest email on file";
    } else {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { error: resendError } = await resend.emails.send({
        from: "Summit Lakeside <contact@summitlakeside.com>",
        to: params.guestEmail,
        subject,
        text: body,
      });
      if (resendError) error = resendError.message;
    }
  }

  await supabase.from("guest_automated_message_log").insert({
    registration_id: params.registrationId,
    message_type: messageTypeKey,
    channel: params.channel,
    error,
  });

  if (error) {
    console.error(`[guest-msg] ${messageTypeKey} failed for registration ${params.registrationId}:`, error);
  }

  return true; // handled the check-in message — caller skips day_of_checkin
}

// Wraps property fetch + sendGuestAutomatedMessage for use in sync.ts (fire-and-forget)
export async function sendGuestConfirmationAsync({
  registrationId,
  lodgifyBookingId,
  channel,
  guestName,
  guestEmail,
  propertyId,
  checkInDate,
  checkOutDate,
}: {
  registrationId: string;
  lodgifyBookingId: number;
  channel: GuestMessageChannel;
  guestName: string;
  guestEmail: string | null;
  propertyId: string;
  checkInDate: string | null;
  checkOutDate: string | null;
}): Promise<void> {
  const supabase = createAdminClient();
  const { data: property } = await supabase
    .from("property")
    .select("name, slug, nickname, host_id")
    .eq("id", propertyId)
    .single();

  if (!property) {
    console.error(`[guest-msg] Property ${propertyId} not found for confirmation`);
    return;
  }

  await sendGuestAutomatedMessage({
    registrationId,
    lodgifyBookingId,
    messageType: "booking_confirmation",
    channel,
    guestName,
    guestEmail,
    propertyName: property.nickname || property.name,
    propertySlug: property.slug,
    checkInDate: checkInDate ?? "",
    checkOutDate: checkOutDate ?? "",
    hostId: property.host_id,
    registered: false, // booking confirmation fires before they could register
  });
}
