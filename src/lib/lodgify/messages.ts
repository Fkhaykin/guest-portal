const LODGIFY_BASE_URL = "https://api.lodgify.com";

function getApiKey() {
  const key = process.env.LODGIFY_API_KEY;
  if (!key) throw new Error("LODGIFY_API_KEY is not set");
  return key;
}

export interface MessageAttachment {
  /** Presigned S3 link from Lodgify. Short-lived (~5 min) — always refetched
   *  from the live thread on open, so treat as ephemeral, never persisted-for-later. */
  url: string;
  /** Original file name, e.g. "image.jpg". Used to infer image vs. other file. */
  name: string;
}

export interface LodgifyMessage {
  id: string;
  message: string;
  subject: string;
  type: "Owner" | "Renter" | "Comment" | string;
  created_at: string;
  sender_name: string;
  // The channel the message travelled on (Lodgify's "route": Vrbo, Airbnb,
  // Booking.com, …). Only some messages carry it; null when unknown.
  route?: string | null;
  // Guest-sent (or Owner-sent) files — photos guests attach in the OTA app.
  // Only present on the v2 thread endpoint, never on the webhook event.
  attachments?: MessageAttachment[];
}

/**
 * Pick the channel for a thread from its messages. Lodgify only stamps "route"
 * on some messages (often the Owner reply), so take the first non-empty one.
 */
export function deriveChannel(messages: LodgifyMessage[]): string | null {
  for (const m of messages) {
    const r = m.route?.trim();
    if (r) return r;
  }
  return null;
}

/**
 * Fetch messages for a Lodgify booking.
 * Gets the thread_uid from the booking detail, then fetches the
 * v2 messaging thread which contains the full conversation.
 */
export async function fetchMessagesForBooking(
  bookingId: number
): Promise<LodgifyMessage[]> {
  const headers = {
    "X-ApiKey": getApiKey(),
    Accept: "application/json",
  };

  // Step 1: Get thread_uid from booking detail
  try {
    const res = await fetch(
      `${LODGIFY_BASE_URL}/v2/reservations/bookings/${bookingId}`,
      { headers, cache: "no-store" }
    );

    if (!res.ok) {
      console.error("[lodgify-messages] Booking detail returned", res.status);
      return [];
    }

    const booking = (await res.json()) as Record<string, unknown>;
    const threadUid = booking.thread_uid as string | undefined;

    if (!threadUid) {
      console.log("[lodgify-messages] No thread_uid on booking", bookingId);
      return [];
    }

    // Step 2: Fetch the message thread
    return await fetchThreadMessages(threadUid);
  } catch (err) {
    console.error("[lodgify-messages] Error fetching messages:", err);
    return [];
  }
}

export interface LodgifyBookingDetail {
  thread_uid: string | null;
  property_id: number | null;
  arrival: string | null;
  departure: string | null;
  status: string | null;
  /** Channel the booking came in on (AirbnbIntegration, HomeAway, …). */
  source: string | null;
}

/**
 * Fetch the booking detail fields we care about: thread_uid plus the
 * property/dates/status context that inquiry threads (which the sync skips)
 * have no other source for.
 */
export async function fetchBookingDetail(
  bookingId: number
): Promise<LodgifyBookingDetail | null> {
  try {
    const res = await fetch(
      `${LODGIFY_BASE_URL}/v2/reservations/bookings/${bookingId}`,
      {
        headers: { "X-ApiKey": getApiKey(), Accept: "application/json" },
        cache: "no-store",
      }
    );
    if (!res.ok) {
      console.error("[lodgify-messages] Booking detail returned", res.status);
      return null;
    }
    const b = (await res.json()) as Record<string, unknown>;
    return {
      thread_uid: typeof b.thread_uid === "string" ? b.thread_uid : null,
      property_id: typeof b.property_id === "number" ? b.property_id : null,
      arrival: typeof b.arrival === "string" ? b.arrival.slice(0, 10) : null,
      departure: typeof b.departure === "string" ? b.departure.slice(0, 10) : null,
      status: typeof b.status === "string" ? b.status : null,
      source: typeof b.source === "string" && b.source.trim() ? b.source.trim() : null,
    };
  } catch (err) {
    console.error("[lodgify-messages] Booking detail error:", err);
    return null;
  }
}

/**
 * Fetch messages from the v2 messaging thread endpoint.
 * Response shape: { thread_uid, guest_name, guest_email, last_message_date,
 *   is_read, messages: [{ id, subject, message, type, date_created, attachments,
 *   message_status, is_read, route, is_imported }], is_closed, error_message }
 */
export async function fetchThreadMessages(
  threadUid: string
): Promise<LodgifyMessage[]> {
  try {
    const res = await fetch(
      `${LODGIFY_BASE_URL}/v2/messaging/${threadUid}`,
      {
        headers: {
          "X-ApiKey": getApiKey(),
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );

    if (!res.ok) {
      console.error("[lodgify-messages] Thread endpoint returned", res.status);
      return [];
    }

    const raw = await res.json();
    const messages = raw.messages;
    if (!Array.isArray(messages)) return [];

    return normalizeMessages(messages, raw.guest_name ?? "");
  } catch (err) {
    console.error("[lodgify-messages] Thread endpoint error:", err);
    return [];
  }
}

/**
 * Send a message to a Lodgify booking.
 */
export async function sendMessage(
  bookingId: number,
  text: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(
      `${LODGIFY_BASE_URL}/v1/reservation/booking/${bookingId}/messages`,
      {
        method: "POST",
        headers: {
          "X-ApiKey": getApiKey(),
          "Content-Type": "application/*+json",
          Accept: "application/json",
        },
        body: JSON.stringify([
          {
            subject: "",
            message: text,
            type: "Owner",
            send_notification: true,
          },
        ]),
      }
    );

    if (!res.ok) {
      const body = await res.text();
      console.error("[lodgify-messages] Send failed:", res.status, body);
      return { success: false, error: `Lodgify API error ${res.status}: ${body}` };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}

export interface ConversationThread {
  /** Lodgify booking id, or the registration UUID for direct bookings. */
  booking_id: number | string;
  /** Registration UUID when this conversation has a reservation; null for
   *  pre-booking enquiries / web chats with no reservation yet. */
  registration_id?: string | null;
  guest_name: string;
  guest_email: string | null;
  property_id: number;
  property_name: string | null;
  arrival: string;
  departure: string;
  status: string;
  source: string | null;
  date_created: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
  /** Registration upsells — lets the composer show paid early check-in /
   *  late check-out times instead of the standard 4pm/11am. */
  upsells?: { type: string; status?: string; label?: string; meta?: Record<string, unknown> | null }[] | null;
}

/**
 * Fetch all Lodgify bookings for the conversations list.
 * Uses only the v1 reservations endpoint (paginated) — no per-booking
 * thread lookups, so this is fast even with hundreds of bookings.
 * Returns bookings sorted by most recently created first.
 */
export async function fetchAllConversations(
  propertyMap: Record<number, string>
): Promise<ConversationThread[]> {
  const headers = {
    "X-ApiKey": getApiKey(),
    Accept: "application/json",
  };

  const allBookings: ConversationThread[] = [];
  let offset = 0;
  const limit = 50;

  while (true) {
    const res = await fetch(
      `${LODGIFY_BASE_URL}/v1/reservation?offset=${offset}&limit=${limit}`,
      { headers, cache: "no-store" }
    );
    if (!res.ok) break;

    const data = (await res.json()) as {
      items: Array<{
        id: number;
        guest: { name: string; email: string | null };
        property_id: number;
        arrival: string | null;
        departure: string | null;
        status: string;
        source: string | null;
        date_created?: string | null;
        created_at?: string | null;
      }>;
      total: number;
    };

    for (const b of data.items) {
      // Skip bookings with no real guest name
      const name = b.guest?.name?.trim();
      if (!name || name.toLowerCase() === "unknown" || name.toLowerCase() === "unknown guest") continue;

      allBookings.push({
        booking_id: b.id,
        guest_name: name,
        guest_email: b.guest.email,
        property_id: b.property_id,
        property_name: propertyMap[b.property_id] ?? null,
        arrival: b.arrival ?? "",
        departure: b.departure ?? "",
        status: b.status,
        source: b.source,
        date_created: b.created_at ?? b.date_created ?? null,
        last_message_at: null,
        last_message_preview: null,
        unread_count: 0,
      });
    }

    if (allBookings.length >= data.total || data.items.length < limit) break;
    offset += limit;
  }

  // v1 API returns newest bookings first by default, but sort explicitly
  allBookings.sort((a, b) => {
    const da = a.date_created ?? "";
    const db = b.date_created ?? "";
    return db.localeCompare(da);
  });

  return allBookings;
}

// --- Normalization ---

// Lodgify returns message timestamps as naive UTC with no zone designator
// (e.g. "2026-06-23T23:10:10"). Without a "Z" the browser's `new Date()`
// parses them in the viewer's local zone, so display ends up hours off.
// Tag them as UTC so every consumer reads the correct instant.
export function toUtcIso(raw: string | null | undefined): string {
  if (!raw) return "";
  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(raw);
  return hasZone ? raw : raw + "Z";
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function normalizeMessages(raw: any[], guestName: string): LodgifyMessage[] {
  return raw.map((item, index) => normalizeMessage(item, index, guestName));
}

function normalizeMessage(raw: any, index: number, guestName: string): LodgifyMessage {
  const type: string = raw.type ?? "Comment";
  // Lodgify shape: attachments: [{ file_name, content_type, content_length,
  // file_url }]. content_type comes back empty, so we key off the file name.
  const attachments: MessageAttachment[] = Array.isArray(raw.attachments)
    ? raw.attachments
        .filter((a: any) => a && typeof a.file_url === "string" && a.file_url)
        .map((a: any) => ({
          url: a.file_url as string,
          name:
            typeof a.file_name === "string" && a.file_name.trim()
              ? a.file_name.trim()
              : "attachment",
        }))
    : [];
  const msg: LodgifyMessage = {
    id: String(raw.id ?? index),
    message: (raw.message ?? "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, ""),
    subject: raw.subject ?? "",
    type,
    created_at: toUtcIso(raw.date_created ?? raw.created_at),
    sender_name: type === "Owner" ? "You" : guestName || "Guest",
    route: typeof raw.route === "string" && raw.route.trim() ? raw.route.trim() : null,
  };
  if (attachments.length) msg.attachments = attachments;
  return msg;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
