import { createAdminClient } from "@/lib/supabase/admin";
import type { NotificationSettings, NotificationEventKey } from "@/types/database";
import twilio from "twilio";

const client = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

const FROM_NUMBER = process.env.TWILIO_FROM_NUMBER;

type NotifyParams = {
  propertyId: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  numGuests: number;
  propertyName?: string;
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function renderTemplate(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

/**
 * Look up the host's notification settings for a property.
 * Returns null if the event is disabled.
 */
async function getEventSettings(
  propertyId: string,
  eventKey: NotificationEventKey
) {
  const supabase = createAdminClient();

  const { data: property } = await supabase
    .from("property")
    .select("host_id, name, nickname")
    .eq("id", propertyId)
    .single();

  if (!property) return null;

  const { data: host } = await supabase
    .from("host")
    .select("notification_settings")
    .eq("id", property.host_id)
    .single();

  const settings = host?.notification_settings as NotificationSettings | null;
  const event = settings?.[eventKey];

  if (!event?.enabled) return null;

  return {
    messageTemplate: event.message,
    propertyName: property.nickname || property.name,
    hostId: property.host_id,
  };
}

/**
 * Send an SMS to all active cleaners assigned to a property.
 */
async function sendToCleaners(propertyId: string, body: string) {
  if (!client || !FROM_NUMBER) {
    console.log("[sms] Twilio not configured, skipping notification");
    return;
  }

  const supabase = createAdminClient();

  const { data: assignments } = await supabase
    .from("cleaner_property")
    .select("cleaner_id")
    .eq("property_id", propertyId);

  if (!assignments?.length) return;

  const { data: cleaners } = await supabase
    .from("cleaner")
    .select("id, name, phone")
    .in("id", assignments.map((a) => a.cleaner_id))
    .eq("is_active", true)
    .not("phone", "is", null);

  if (!cleaners?.length) return;

  const results = await Promise.allSettled(
    cleaners.map((cleaner) =>
      client.messages.create({
        to: cleaner.phone!,
        from: FROM_NUMBER,
        body,
      })
    )
  );

  for (let i = 0; i < results.length; i++) {
    if (results[i].status === "rejected") {
      console.error(
        `[sms] Failed to notify cleaner ${cleaners[i].name}:`,
        (results[i] as PromiseRejectedResult).reason
      );
    }
  }
}

/**
 * Notify cleaners of a new booking (if enabled in host settings).
 */
export async function notifyCleanersOfNewBooking(params: NotifyParams) {
  const config = await getEventSettings(params.propertyId, "cleaner_new_booking");
  if (!config) return;

  const body = renderTemplate(config.messageTemplate, {
    property: config.propertyName,
    guest: params.guestName,
    check_in: formatDate(params.checkIn),
    check_out: formatDate(params.checkOut),
    num_guests: String(params.numGuests),
  });

  await sendToCleaners(params.propertyId, body);
}

/**
 * Notify cleaners of a cancelled booking (if enabled in host settings).
 */
export async function notifyCleanersOfCancellation(params: NotifyParams) {
  const config = await getEventSettings(params.propertyId, "cleaner_cancellation");
  if (!config) return;

  const body = renderTemplate(config.messageTemplate, {
    property: config.propertyName,
    guest: params.guestName,
    check_in: formatDate(params.checkIn),
    check_out: formatDate(params.checkOut),
  });

  await sendToCleaners(params.propertyId, body);
}

/**
 * Notify cleaners of a guest checkout (if enabled in host settings).
 */
export async function notifyCleanersOfCheckout(params: {
  propertyId: string;
  guestName: string;
}) {
  const config = await getEventSettings(params.propertyId, "cleaner_checkout");
  if (!config) return;

  const body = renderTemplate(config.messageTemplate, {
    property: config.propertyName,
    guest: params.guestName,
  });

  await sendToCleaners(params.propertyId, body);
}
