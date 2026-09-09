import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMessage } from "@/lib/lodgify/messages";
import {
  TEMPLATES,
  interpolate,
  firstNameOf,
  isDirectBookingSource,
  formatMessageDate,
  portalSectionLink,
  type TemplateVars,
} from "./templates";
import { claimMessageSlot } from "./send";
import { stripUrlsForSms } from "@/lib/sms/sanitize";
import { sendGuestSms } from "@/lib/sms/send-guest-sms";
import type { GuestMessageSettings, PetEntry } from "@/types/database";

/**
 * Guests can finish registering without their pet's paperwork (they tick "I'll
 * provide the vaccination records later" — completing the registration matters
 * more than collecting the records on the spot). These are the nudges that
 * chase the records afterwards.
 */
export const PET_DOC_REMINDER_DAYS = [5, 2] as const;
export type PetDocReminderDay = (typeof PET_DOC_REMINDER_DAYS)[number];

/** Pets still missing at least one of the two required records. */
export function petsMissingDocs(pets: PetEntry[] | null): PetEntry[] {
  return (pets ?? []).filter(
    (p) => p.name?.trim() && (!p.rabies_doc_path || !p.vaccination_doc_path)
  );
}

/** "Nico", "Nico and Luna", "Nico, Luna and Bo" */
export function formatPetNames(pets: PetEntry[]): string {
  const names = pets.map((p) => p.name.trim()).filter(Boolean);
  if (names.length <= 1) return names[0] ?? "your pet";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

interface SendPetDocReminderParams {
  registrationId: string;
  lodgifyBookingId: number | null;
  daysUntilCheckin: PetDocReminderDay;
  bookingSource: string | null;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  propertyName: string;
  propertySlug: string;
  checkInDate: string;
  checkOutDate: string;
  hostId: string;
  pets: PetEntry[];
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

export async function sendPetDocReminder(
  params: SendPetDocReminderParams
): Promise<"sent" | "skipped" | "duplicate"> {
  const supabase = createAdminClient();
  const messageTypeKey = `pet_docs_reminder_d${params.daysUntilCheckin}`;

  const { data: existing } = await supabase
    .from("guest_automated_message_log")
    .select("id")
    .eq("registration_id", params.registrationId)
    .eq("message_type", messageTypeKey)
    .maybeSingle();
  if (existing) return "duplicate";

  const hostSettings = await getHostSettings(params.hostId);
  const eventSettings = hostSettings?.pet_docs_reminder;
  if (eventSettings && eventSettings.enabled === false) return "skipped";

  const vars: TemplateVars = {
    guest_name: firstNameOf(params.guestName),
    property_name: params.propertyName,
    check_in_date: formatMessageDate(params.checkInDate),
    check_out_date: formatMessageDate(params.checkOutDate),
    check_in_time: "",
    check_out_time: "",
    pet_names: formatPetNames(params.pets),
    // Deep link: the root lookup forwards them to Manage Your Stay, where the
    // pets section flags exactly which records are outstanding.
    portal_link: portalSectionLink(`/p/${params.propertySlug}/update`),
  };

  const defaults = TEMPLATES.pet_docs_reminder;
  const subject = interpolate(eventSettings?.subject ?? defaults.subject, vars);
  const body = interpolate(eventSettings?.message ?? defaults.body, vars);

  // Claim before sending so concurrent runs can't both fire this reminder.
  // Released below if no channel was usable, so a later run can retry.
  const claimedId = await claimMessageSlot(supabase, params.registrationId, messageTypeKey);
  if (!claimedId) return "duplicate";

  const channelsAttempted: string[] = [];
  const errors: string[] = [];

  if (isDirectBookingSource(params.bookingSource)) {
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
    // OTA guests (often no email on file) get it on the Lodgify thread.
    const result = await sendMessage(params.lodgifyBookingId, body);
    channelsAttempted.push("lodgify");
    if (!result.success) errors.push(`lodgify: ${result.error ?? "unknown"}`);
  }

  if (params.guestPhone) {
    // SMS can't carry the link until Textbelt whitelists the key, so the text
    // asks them to reply instead — inbound SMS reaches the host. The live link
    // goes out on the primary channel above.
    const smsBody = stripUrlsForSms(
      body,
      "(reply to this text and we'll send you the upload link)"
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
    console.error(`[pet-doc-reminder] ${messageTypeKey} for ${params.registrationId}: ${errors.join("; ")}`);
  }

  return "sent";
}
