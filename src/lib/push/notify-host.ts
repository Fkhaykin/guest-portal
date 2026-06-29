import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToHost, type PushPayload } from "@/lib/push/send-push";

function adminUrl(path: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  if (!appUrl) return "";
  try {
    const url = new URL(appUrl);
    url.hostname = url.hostname.replace(/^(guest|manager)\./, "");
    if (!url.hostname.startsWith("admin.")) {
      url.hostname = `admin.${url.hostname}`;
    }
    return `${url.origin}${path}`;
  } catch {
    return "";
  }
}

/** Deep-link to a specific reservation when we have its id, else the list. */
function reservationUrl(registrationId?: string | null): string {
  return adminUrl(
    registrationId ? `/reservations/${registrationId}` : "/reservations"
  );
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** Property display name + host to notify, or null if the property is unknown. */
async function getProperty(propertyId: string) {
  const supabase = createAdminClient();
  const { data: property } = await supabase
    .from("property")
    .select("host_id, name, nickname")
    .eq("id", propertyId)
    .single();
  if (!property) return null;
  return {
    hostId: property.host_id,
    name: property.nickname || property.name,
  };
}

/** Send to every host — fallback when an event can't be tied to a property. */
async function pushToAllHosts(payload: PushPayload) {
  const supabase = createAdminClient();
  const { data: hosts } = await supabase.from("host").select("id");
  if (!hosts?.length) return;
  await Promise.all(hosts.map((h) => sendPushToHost(h.id, payload)));
}

export async function notifyHostOfGuestMessage(params: {
  guestName: string | null;
  preview: string;
  lodgifyBookingId: number | null;
  /** Direct (non-Lodgify) bookings are identified by registration id instead. */
  registrationId?: string | null;
  /** Explicit inbox deep-link key (?booking=...) when the addressable id differs
   *  from the host-targeting ids — e.g. an orphan web thread ("web:<uuid>"), or a
   *  web chat linked to a Lodgify booking (the inbox keys those by numeric id). */
  threadKey?: string | number | null;
}) {
  const linkKey =
    params.threadKey ?? params.lodgifyBookingId ?? params.registrationId;
  const payload: PushPayload = {
    title: params.guestName
      ? `Message from ${params.guestName}`
      : "New guest message",
    body: params.preview,
    url: adminUrl(linkKey ? `/messages?booking=${linkKey}` : "/messages"),
  };

  // Tie the message to a host via its booking when we can; otherwise notify all
  if (params.lodgifyBookingId || params.registrationId) {
    const supabase = createAdminClient();
    const query = supabase.from("registration").select("property_id");
    const { data: reg } = await (params.lodgifyBookingId
      ? query.eq("lodgify_booking_id", params.lodgifyBookingId)
      : query.eq("id", params.registrationId)
    ).maybeSingle();
    if (reg?.property_id) {
      const property = await getProperty(reg.property_id);
      if (property) {
        await sendPushToHost(property.hostId, payload);
        return;
      }
    }
  }
  await pushToAllHosts(payload);
}

export async function notifyHostOfNewBooking(params: {
  propertyId: string;
  registrationId?: string | null;
  guestName: string;
  checkIn: string;
  checkOut: string;
  numGuests: number;
}) {
  const property = await getProperty(params.propertyId);
  if (!property) return;

  await sendPushToHost(property.hostId, {
    title: `New booking — ${property.name}`,
    body: `${params.guestName} · ${formatDate(params.checkIn)} – ${formatDate(params.checkOut)} · ${params.numGuests} guest${params.numGuests !== 1 ? "s" : ""}`,
    url: reservationUrl(params.registrationId),
  });
}

export async function notifyHostOfCancellation(params: {
  propertyId: string;
  registrationId?: string | null;
  guestName: string;
  checkIn: string;
  checkOut: string;
}) {
  const property = await getProperty(params.propertyId);
  if (!property) return;

  await sendPushToHost(property.hostId, {
    title: `Booking cancelled — ${property.name}`,
    body: `${params.guestName} · ${formatDate(params.checkIn)} – ${formatDate(params.checkOut)}`,
    url: reservationUrl(params.registrationId),
  });
}

export async function notifyHostOfBookingChange(params: {
  propertyId: string;
  registrationId?: string | null;
  guestName: string;
  summary: string;
}) {
  const property = await getProperty(params.propertyId);
  if (!property) return;

  await sendPushToHost(property.hostId, {
    title: `Booking updated — ${property.name}`,
    body: `${params.guestName}: ${params.summary}`,
    url: reservationUrl(params.registrationId),
  });
}

export async function notifyHostOfRegistration(params: {
  propertyId: string;
  registrationId?: string | null;
  guestName: string;
  summary?: string;
  isUpdate?: boolean;
}) {
  const property = await getProperty(params.propertyId);
  if (!property) return;

  await sendPushToHost(property.hostId, {
    title: params.isUpdate
      ? `Registration updated — ${property.name}`
      : `Registration completed — ${property.name}`,
    body: params.summary || params.guestName,
    url: reservationUrl(params.registrationId),
  });
}

export async function notifyHostOfUpsellPurchase(params: {
  propertyId: string;
  registrationId?: string | null;
  guestName: string;
  labels: string[];
  totalCents: number;
}) {
  const property = await getProperty(params.propertyId);
  if (!property) return;

  const amount = (params.totalCents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });

  await sendPushToHost(property.hostId, {
    title: `Upsell purchased — ${property.name}`,
    body: `${params.guestName}: ${params.labels.join(", ")} (${amount})`,
    url: reservationUrl(params.registrationId),
  });
}
