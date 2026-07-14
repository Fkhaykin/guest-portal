import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMessage } from "@/lib/lodgify/messages";
import { TEMPLATES, PORTAL_URL, interpolate, firstNameOf, registrationCta, type GuestMessageType, type GuestMessageChannel, type TemplateVars } from "./templates";
import { HOUSE_CHECKIN_TEMPLATES, HOUSE_CHECKIN_SUBJECT } from "./house-templates";
import { houseForProperty } from "./quick-replies";
import { stayTimeVars } from "@/lib/upsells/timing";
import { stripUrlsForSms } from "@/lib/sms/sanitize";
import { sendGuestSms } from "@/lib/sms/send-guest-sms";
import type { GuestMessageSettings, UpsellEntry } from "@/types/database";

interface SendParams {
  registrationId: string;
  lodgifyBookingId: number;
  messageType: GuestMessageType;
  channel: GuestMessageChannel;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string | null;
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

// Atomically claim the (registration_id, message_type) slot before a send.
// Backed by the guest_automated_message_log_dedup unique index: the upsert with
// ignoreDuplicates issues INSERT ... ON CONFLICT DO NOTHING, so exactly one of N
// concurrent callers gets a row back (the winner) and the rest get an empty set.
// Only the winner proceeds to deliver, which closes the check-then-send race that
// let concurrent Lodgify webhook actions each send their own copy of a message.
// The row is inserted with a placeholder channel; the caller updates it with the
// real channel/error once delivery completes. Returns the claimed row id, or null
// if the slot was already taken.
export async function claimMessageSlot(
  supabase: ReturnType<typeof createAdminClient>,
  registrationId: string,
  messageType: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("guest_automated_message_log")
    .upsert(
      { registration_id: registrationId, message_type: messageType, channel: "pending" },
      { onConflict: "registration_id,message_type", ignoreDuplicates: true }
    )
    .select("id");

  if (error) {
    // Treat an errored claim as "not ours" — skipping a send is safer than the
    // duplicate we're trying to prevent, and a later run can still claim it.
    console.error(`[guest-msg] claim failed for ${registrationId}/${messageType}:`, error);
    return null;
  }
  return data && data.length > 0 ? data[0].id : null;
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

  // The generic day-of-check-in message carries the long check-in details, so
  // its SMS gets the short pointer; all other message types text their full body.
  const smsOverride =
    params.messageType === "day_of_checkin" ? conciseCheckinSms(params.propertyName) : undefined;

  // Atomically claim the slot before delivering. If a concurrent run already
  // claimed it (e.g. a burst of Lodgify webhook actions syncing one booking at
  // once), bail without sending — this is what prevents duplicate messages.
  const claimedId = await claimMessageSlot(supabase, params.registrationId, params.messageType);
  if (!claimedId) return;

  const { channel, error } = await deliver(params, subject, body, params.messageType, smsOverride);

  await supabase
    .from("guest_automated_message_log")
    .update({ channel, error })
    .eq("id", claimedId);

  if (error) {
    console.error(`[guest-msg] ${params.messageType} failed for registration ${params.registrationId}:`, error);
  }
}

// Deliver a rendered message on its booking's channel(s): OTA bookings go to the
// Lodgify thread; direct bookings go to email AND — where a phone is on file — a
// text (the reminders path does the same). Links are stripped from the SMS until
// Textbelt whitelists the key (see @/lib/sms/sanitize). Returns the combined
// channel label and joined error string for the automated-message log.
async function deliver(
  params: SendParams,
  subject: string,
  body: string,
  eventType: string,
  smsBody?: string
): Promise<{ channel: string; error: string | null }> {
  const channels: string[] = [];
  const errors: string[] = [];

  if (params.channel === "lodgify") {
    const result = await sendMessage(params.lodgifyBookingId, body);
    channels.push("lodgify");
    if (!result.success) errors.push(`lodgify: ${result.error ?? "Unknown Lodgify error"}`);
  } else {
    if (!params.guestEmail) {
      errors.push("email: No guest email on file");
    } else {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { error: resendError } = await resend.emails.send({
        from: "Summit Lakeside <contact@summitlakeside.com>",
        to: params.guestEmail,
        subject,
        text: body,
      });
      channels.push("email");
      if (resendError) errors.push(`email: ${resendError.message}`);
    }

    // Direct bookings also get a text where we have a number. `smsBody` lets a
    // caller substitute a short SMS for a long email (see check-in below).
    if (params.guestPhone) {
      const smsText = stripUrlsForSms(smsBody ?? body, "(reply to this text and we'll send you the link)");
      const smsResult = await sendGuestSms(params.guestPhone, smsText, {
        eventType,
        lodgifyBookingId: params.lodgifyBookingId,
        registrationId: params.registrationId,
      });
      channels.push("sms");
      if (!smsResult.success) errors.push(`sms: ${smsResult.error ?? "unknown"}`);
    }
  }

  return {
    channel: channels.join(",") || params.channel,
    error: errors.length ? errors.join("; ") : null,
  };
}

// Check-in instructions run long (gate + lockbox + parking + WiFi + house rules)
// — far too much for SMS. Text a short pointer to the email instead; the full
// instructions (including access codes) still go out by email.
function conciseCheckinSms(propertyName: string): string {
  return `Your check-in details for ${propertyName} have been emailed to you — please check your inbox for gate, door, parking, and WiFi info. Reply here anytime with questions. — Summit Lakeside`;
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

  // Atomically claim before delivering (see claimMessageSlot). If a concurrent
  // run already claimed it, treat as handled so the caller still skips
  // day_of_checkin rather than falling back to a near-duplicate generic message.
  const claimedId = await claimMessageSlot(supabase, params.registrationId, messageTypeKey);
  if (!claimedId) return true;

  const { channel, error } = await deliver(
    params,
    subject,
    body,
    messageTypeKey,
    conciseCheckinSms(params.propertyName)
  );

  await supabase
    .from("guest_automated_message_log")
    .update({ channel, error })
    .eq("id", claimedId);

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
  guestPhone,
  propertyId,
  checkInDate,
  checkOutDate,
}: {
  registrationId: string;
  lodgifyBookingId: number;
  channel: GuestMessageChannel;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string | null;
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
    guestPhone,
    propertyName: property.nickname || property.name,
    propertySlug: property.slug,
    checkInDate: checkInDate ?? "",
    checkOutDate: checkOutDate ?? "",
    hostId: property.host_id,
    registered: false, // booking confirmation fires before they could register
  });
}

// Sends the booking_confirmation for a booking created through OUR OWN flow
// (Stripe checkout or an admin invoice) once it has been pushed to Lodgify.
// Inbound Lodgify/Airbnb bookings are confirmed from sync.ts instead; that path's
// guard (justBecameActive) is false for our own bookings because our webhook sets
// the registration active before Lodgify echoes the booking back — so without this
// they'd never get a confirmation. Always email (these are Direct bookings).
// Dedup is handled by sendGuestAutomatedMessage (message_type booking_confirmation),
// so this is safe to call more than once for the same registration.
export async function sendDirectBookingConfirmation(registrationId: string): Promise<void> {
  const supabase = createAdminClient();
  const { data: reg } = await supabase
    .from("registration")
    .select(
      "id, lodgify_booking_id, check_in_date, check_out_date, property_id, guest:guest_id(full_name, email, phone)"
    )
    .eq("id", registrationId)
    .single();

  // Only confirm once the booking is actually holding the calendar in Lodgify.
  if (!reg?.lodgify_booking_id) return;

  const guest = reg.guest as unknown as { full_name: string; email: string | null; phone: string | null } | null;

  await sendGuestConfirmationAsync({
    registrationId: reg.id,
    lodgifyBookingId: reg.lodgify_booking_id,
    channel: "email",
    guestName: guest?.full_name ?? "Guest",
    guestEmail: guest?.email ?? null,
    guestPhone: guest?.phone ?? null,
    propertyId: reg.property_id,
    checkInDate: reg.check_in_date,
    checkOutDate: reg.check_out_date,
  });
}
