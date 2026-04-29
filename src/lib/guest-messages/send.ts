import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMessage } from "@/lib/lodgify/messages";
import { renderTemplate, type GuestMessageType, type GuestMessageChannel } from "./templates";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://guest.summitlakeside.com";

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

  const portalLink = `${APP_URL}/p/${params.propertySlug}/register`;
  const { subject, body } = renderTemplate(params.messageType, {
    guest_name: params.guestName,
    property_name: params.propertyName,
    check_in_date: params.checkInDate,
    check_out_date: params.checkOutDate,
    portal_link: portalLink,
  });

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
    .select("name, slug, nickname")
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
  });
}
