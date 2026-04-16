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
