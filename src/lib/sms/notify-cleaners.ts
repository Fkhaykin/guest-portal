import { createAdminClient } from "@/lib/supabase/admin";
import type { NotificationSettings, NotificationEventKey } from "@/types/database";

const TEXTBELT_KEY = process.env.TEXTBELT_API_KEY;

async function sendSms(to: string, message: string) {
  if (!TEXTBELT_KEY) {
    console.log("[sms] Textbelt not configured, skipping notification");
    return;
  }
  const res = await fetch("https://textbelt.com/text", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: to, message, key: TEXTBELT_KEY }),
  });
  const data = await res.json();
  if (!data.success) console.error("[sms] Textbelt error:", data.error);
}

type NotifyParams = {
  propertyId: string;
  registrationId: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  numGuests: number;
  numPets?: number;
  notes?: string | null;
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

function cleanerPortalUrl(registrationId: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  if (!appUrl || !registrationId) return "";
  try {
    const url = new URL(appUrl);
    url.hostname = url.hostname.replace(/^(guest|admin)\./, "");
    if (!url.hostname.startsWith("manager.")) {
      url.hostname = `manager.${url.hostname}`;
    }
    return `${url.origin}/reservations/${registrationId}`;
  } catch {
    return "";
  }
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
    .select("host_id, name, nickname, address")
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
    propertyAddress: (property.address as string | null) ?? "",
    hostId: property.host_id,
  };
}

/**
 * Send an SMS to all active cleaners assigned to a property.
 */
async function sendToCleaners(propertyId: string, body: string) {
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

  await Promise.all(cleaners.map((cleaner) => sendSms(cleaner.phone!, body)));
}

export async function notifyCleanersOfNewBooking(params: NotifyParams) {
  const config = await getEventSettings(params.propertyId, "cleaner_new_booking");
  if (!config) return;

  const numPets = params.numPets ?? 0;
  const petsText = numPets > 0 ? `, ${numPets} pet${numPets !== 1 ? "s" : ""}` : "";
  const notesText = params.notes ? `\nNotes: ${params.notes}` : "";
  const link = cleanerPortalUrl(params.registrationId);

  const body = renderTemplate(config.messageTemplate, {
    property: config.propertyName,
    address: config.propertyAddress,
    guest: params.guestName,
    check_in: formatDate(params.checkIn),
    check_out: formatDate(params.checkOut),
    num_guests: String(params.numGuests),
    pets_text: petsText,
    notes_text: notesText,
    link,
  });

  await sendToCleaners(params.propertyId, body);
}

export async function notifyCleanersOfCancellation(params: NotifyParams) {
  const config = await getEventSettings(params.propertyId, "cleaner_cancellation");
  if (!config) return;

  const body = renderTemplate(config.messageTemplate, {
    property: config.propertyName,
    address: config.propertyAddress,
    guest: params.guestName,
    check_in: formatDate(params.checkIn),
    check_out: formatDate(params.checkOut),
  });

  await sendToCleaners(params.propertyId, body);
}

export async function notifyCleanersOfCheckout(params: {
  propertyId: string;
  registrationId: string;
  guestName: string;
}) {
  const config = await getEventSettings(params.propertyId, "cleaner_checkout");
  if (!config) return;

  const body = renderTemplate(config.messageTemplate, {
    property: config.propertyName,
    address: config.propertyAddress,
    guest: params.guestName,
    link: cleanerPortalUrl(params.registrationId),
  });

  await sendToCleaners(params.propertyId, body);
}

export async function notifyCleanersOfPetAdded(params: {
  propertyId: string;
  registrationId: string;
  guestName: string;
  checkIn: string;
  numPets: number;
}) {
  const config = await getEventSettings(params.propertyId, "cleaner_pet_added");
  if (!config) return;

  const body = renderTemplate(config.messageTemplate, {
    property: config.propertyName,
    address: config.propertyAddress,
    guest: params.guestName,
    check_in: formatDate(params.checkIn),
    num_pets: String(params.numPets),
    link: cleanerPortalUrl(params.registrationId),
  });

  await sendToCleaners(params.propertyId, body);
}

export async function notifyCleanersOfEarlyCheckin(params: {
  propertyId: string;
  registrationId: string;
  guestName: string;
  checkIn: string;
}) {
  const config = await getEventSettings(params.propertyId, "cleaner_early_checkin");
  if (!config) return;

  const body = renderTemplate(config.messageTemplate, {
    property: config.propertyName,
    address: config.propertyAddress,
    guest: params.guestName,
    check_in: formatDate(params.checkIn),
    link: cleanerPortalUrl(params.registrationId),
  });

  await sendToCleaners(params.propertyId, body);
}

export async function notifyCleanersOfLateCheckout(params: {
  propertyId: string;
  registrationId: string;
  guestName: string;
  checkOut: string;
}) {
  const config = await getEventSettings(params.propertyId, "cleaner_late_checkout");
  if (!config) return;

  const body = renderTemplate(config.messageTemplate, {
    property: config.propertyName,
    address: config.propertyAddress,
    guest: params.guestName,
    check_out: formatDate(params.checkOut),
    link: cleanerPortalUrl(params.registrationId),
  });

  await sendToCleaners(params.propertyId, body);
}
