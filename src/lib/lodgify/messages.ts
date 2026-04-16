const LODGIFY_BASE_URL = "https://api.lodgify.com";

function getApiKey() {
  const key = process.env.LODGIFY_API_KEY;
  if (!key) throw new Error("LODGIFY_API_KEY is not set");
  return key;
}

export interface LodgifyMessage {
  id: string;
  message: string;
  subject: string;
  type: "Owner" | "Renter" | "Comment" | string;
  created_at: string;
  sender_name: string;
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

/**
 * Fetch messages from the v2 messaging thread endpoint.
 * Response shape: { thread_uid, guest_name, guest_email, last_message_date,
 *   is_read, messages: [{ id, subject, message, type, date_created, attachments,
 *   message_status, is_read, route, is_imported }], is_closed, error_message }
 */
async function fetchThreadMessages(
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
  booking_id: number;
  guest_name: string;
  guest_email: string | null;
  property_id: number;
  property_name: string | null;
  arrival: string;
  departure: string;
  status: string;
  source: string | null;
  last_message_date: string | null;
  last_message_preview: string | null;
  is_read: boolean;
}

/**
 * Fetch all Lodgify bookings with thread metadata for the conversations list.
 * Pulls from Lodgify v1 reservations (paginated), then fetches v2 booking
 * details for thread_uid and thread metadata for last_message_date.
 */
export async function fetchAllConversations(
  propertyMap: Record<number, string>
): Promise<ConversationThread[]> {
  const headers = {
    "X-ApiKey": getApiKey(),
    Accept: "application/json",
  };

  // Step 1: Fetch all bookings from Lodgify v1 (paginated)
  const allBookings: Array<{
    id: number;
    guest_name: string;
    guest_email: string | null;
    property_id: number;
    arrival: string;
    departure: string;
    status: string;
    source: string | null;
  }> = [];

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
      }>;
      total: number;
    };

    for (const b of data.items) {
      allBookings.push({
        id: b.id,
        guest_name: b.guest.name,
        guest_email: b.guest.email,
        property_id: b.property_id,
        arrival: b.arrival ?? "",
        departure: b.departure ?? "",
        status: b.status,
        source: b.source,
      });
    }

    if (allBookings.length >= data.total || data.items.length < limit) break;
    offset += limit;
  }

  // Step 2: For each booking, fetch v2 detail for thread_uid, then thread metadata
  const CONCURRENCY = 15;
  const results: ConversationThread[] = [];

  for (let i = 0; i < allBookings.length; i += CONCURRENCY) {
    const batch = allBookings.slice(i, i + CONCURRENCY);
    await Promise.allSettled(
      batch.map(async (booking) => {
        let lastMessageDate: string | null = null;
        let lastMessagePreview: string | null = null;
        let isRead = true;

        try {
          const bookingRes = await fetch(
            `${LODGIFY_BASE_URL}/v2/reservations/bookings/${booking.id}`,
            { headers, cache: "no-store" }
          );

          if (bookingRes.ok) {
            const detail = (await bookingRes.json()) as Record<string, unknown>;
            const threadUid = detail.thread_uid as string | undefined;

            if (threadUid) {
              const threadRes = await fetch(
                `${LODGIFY_BASE_URL}/v2/messaging/${threadUid}`,
                { headers, cache: "no-store" }
              );

              if (threadRes.ok) {
                const thread = (await threadRes.json()) as Record<string, unknown>;
                lastMessageDate = (thread.last_message_date as string) ?? null;
                isRead = (thread.is_read as boolean) ?? true;

                // Get preview from last message
                const msgs = thread.messages as Array<Record<string, unknown>> | undefined;
                if (msgs && msgs.length > 0) {
                  const last = msgs[msgs.length - 1];
                  const msg = (last.message as string) ?? "";
                  lastMessagePreview = msg.replace(/<[^>]+>/g, "").slice(0, 80) || null;
                }
              }
            }
          }
        } catch {
          // Skip failures silently
        }

        results.push({
          booking_id: booking.id,
          guest_name: booking.guest_name,
          guest_email: booking.guest_email,
          property_id: booking.property_id,
          property_name: propertyMap[booking.property_id] ?? null,
          arrival: booking.arrival,
          departure: booking.departure,
          status: booking.status,
          source: booking.source,
          last_message_date: lastMessageDate,
          last_message_preview: lastMessagePreview,
          is_read: isRead,
        });
      })
    );
  }

  // Sort by last_message_date descending (threads with messages first)
  results.sort((a, b) => {
    if (a.last_message_date && b.last_message_date)
      return b.last_message_date.localeCompare(a.last_message_date);
    if (a.last_message_date) return -1;
    if (b.last_message_date) return 1;
    return b.arrival.localeCompare(a.arrival);
  });

  return results;
}

// --- Normalization ---

/* eslint-disable @typescript-eslint/no-explicit-any */
function normalizeMessages(raw: any[], guestName: string): LodgifyMessage[] {
  return raw.map((item, index) => normalizeMessage(item, index, guestName));
}

function normalizeMessage(raw: any, index: number, guestName: string): LodgifyMessage {
  const type: string = raw.type ?? "Comment";
  return {
    id: String(raw.id ?? index),
    message: (raw.message ?? "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, ""),
    subject: raw.subject ?? "",
    type,
    created_at: raw.date_created ?? raw.created_at ?? "",
    sender_name: type === "Owner" ? "You" : guestName || "Guest",
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
