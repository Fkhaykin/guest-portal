import { createAdminClient } from "@/lib/supabase/admin";
import type { NotificationSettings, NotificationEventKey } from "@/types/database";

const TEXTBELT_KEY = process.env.TEXTBELT_API_KEY?.trim();

export async function sendSms(
  to: string,
  message: string,
  meta: { recipientName?: string; eventType: string; propertyId?: string; lodgifyBookingId?: number }
) {
  const supabase = createAdminClient();

  if (!TEXTBELT_KEY) {
    console.log("[sms] Textbelt not configured, skipping notification");
    await supabase.from("sms_log").insert({
      recipient_phone: to,
      recipient_name: meta.recipientName ?? null,
      message,
      event_type: meta.eventType,
      lodgify_booking_id: meta.lodgifyBookingId ?? null,
      property_id: meta.propertyId ?? null,
      success: false,
      error: "TEXTBELT_API_KEY not configured",
    });
    return;
  }

  const res = await fetch("https://textbelt.com/text", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: to, message, key: TEXTBELT_KEY }),
  });
  const data = await res.json();

  if (!data.success) console.error("[sms] Textbelt error:", data.error);

  await supabase.from("sms_log").insert({
    recipient_phone: to,
    recipient_name: meta.recipientName ?? null,
    message,
    event_type: meta.eventType,
    lodgify_booking_id: meta.lodgifyBookingId ?? null,
    property_id: meta.propertyId ?? null,
    success: data.success === true,
    error: data.error ?? null,
    quota_remaining: typeof data.quotaRemaining === "number" ? data.quotaRemaining : null,
  });
}

type NotifyParams = {
  propertyId: string;
  registrationId: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  numGuests: number;
  numInfants?: number;
  numPets?: number;
  notes?: string | null;
  upsells?: string[];
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

// "Lakeside Drive, 475, East Stroudsburg, PA, 18301" → "475 Lakeside Drive"
function formatAddress(raw: string): string {
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2 && /^\d+$/.test(parts[1])) {
    return `${parts[1]} ${parts[0]}`;
  }
  return parts[0] || raw;
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

  const rawAddress = (property.address as string | null) ?? "";
  return {
    messageTemplate: event.message,
    propertyName: property.nickname || property.name,
    propertyAddress: rawAddress ? formatAddress(rawAddress) : "",
    hostId: property.host_id,
  };
}

/**
 * Send an SMS to all active cleaners assigned to a property.
 */
async function sendToCleaners(
  propertyId: string,
  body: string,
  meta: { eventType: string; lodgifyBookingId?: number }
) {
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

  await Promise.all(
    cleaners.map((cleaner) =>
      sendSms(cleaner.phone!, body, {
        recipientName: cleaner.name ?? undefined,
        eventType: meta.eventType,
        propertyId,
        lodgifyBookingId: meta.lodgifyBookingId,
      })
    )
  );
}

export async function notifyCleanersOfNewBooking(params: NotifyParams) {
  const config = await getEventSettings(params.propertyId, "cleaner_new_booking");
  if (!config) return;

  const numPets = params.numPets ?? 0;
  const numInfants = params.numInfants ?? 0;
  const extras: string[] = [];
  if (numPets > 0) extras.push(`${numPets} pet${numPets !== 1 ? "s" : ""}`);
  if (numInfants > 0) extras.push(`${numInfants} infant${numInfants !== 1 ? "s" : ""}`);
  if (params.upsells?.length) extras.push(...params.upsells);
  const extrasText = extras.length > 0 ? `\n${extras.join(", ")}` : "";
  const notesText = params.notes ? `\nNotes: ${params.notes}` : "";
  const link = cleanerPortalUrl(params.registrationId);

  const body = renderTemplate(config.messageTemplate, {
    property: config.propertyName,
    address: config.propertyAddress,
    guest: params.guestName,
    check_in: formatDate(params.checkIn),
    check_out: formatDate(params.checkOut),
    num_guests: String(params.numGuests),
    extras_text: extrasText,
    notes_text: notesText,
    link,
  });

  await sendToCleaners(params.propertyId, body, { eventType: "cleaner_new_booking", lodgifyBookingId: undefined });
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

  await sendToCleaners(params.propertyId, body, { eventType: "cleaner_cancellation" });
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

  await sendToCleaners(params.propertyId, body, { eventType: "cleaner_checkout" });
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

  await sendToCleaners(params.propertyId, body, { eventType: "cleaner_pet_added" });
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

  await sendToCleaners(params.propertyId, body, { eventType: "cleaner_early_checkin" });
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

  await sendToCleaners(params.propertyId, body, { eventType: "cleaner_late_checkout" });
}

export async function notifyCleanerOfInvoicePaid(params: {
  cleanerId: string;
  hostId: string;
  invoiceNumber: string;
  total: number;
  periodStart: string;
  periodEnd: string;
}) {
  const supabase = createAdminClient();

  const { data: host } = await supabase
    .from("host")
    .select("notification_settings")
    .eq("id", params.hostId)
    .single();

  const settings = host?.notification_settings as NotificationSettings | null;
  const event = settings?.cleaner_invoice_paid;
  if (!event?.enabled) return;

  const { data: cleaner } = await supabase
    .from("cleaner")
    .select("id, name, phone, is_active")
    .eq("id", params.cleanerId)
    .single();

  if (!cleaner?.phone || !cleaner.is_active) return;

  const amount = (params.total / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });

  const body = renderTemplate(event.message, {
    invoice_number: params.invoiceNumber,
    amount,
    period_start: formatDate(params.periodStart),
    period_end: formatDate(params.periodEnd),
  });

  await sendSms(cleaner.phone, body, {
    recipientName: cleaner.name ?? undefined,
    eventType: "cleaner_invoice_paid",
  });
}
