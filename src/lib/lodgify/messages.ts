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
 * Tries GET /v1/reservation/booking/{id}/messages first,
 * falls back to extracting messages from the booking detail endpoint.
 */
export async function fetchMessagesForBooking(
  bookingId: number
): Promise<LodgifyMessage[]> {
  const headers = {
    "X-ApiKey": getApiKey(),
    Accept: "application/json",
  };

  // Try the dedicated messages endpoint
  try {
    const res = await fetch(
      `${LODGIFY_BASE_URL}/v1/reservation/booking/${bookingId}/messages`,
      { headers }
    );

    if (res.ok) {
      const raw = await res.json();
      console.log(
        "[lodgify-messages] GET messages response shape:",
        JSON.stringify(raw).slice(0, 500)
      );
      return normalizeMessages(raw);
    }

    console.log(
      "[lodgify-messages] Messages endpoint returned",
      res.status,
      "— falling back to booking detail"
    );
  } catch (err) {
    console.error("[lodgify-messages] Messages endpoint error:", err);
  }

  // Fallback: fetch booking detail and extract messages field
  try {
    const res = await fetch(
      `${LODGIFY_BASE_URL}/v2/reservations/bookings/${bookingId}`,
      { headers }
    );

    if (res.ok) {
      const raw = (await res.json()) as Record<string, unknown>;
      console.log(
        "[lodgify-messages] Booking detail keys:",
        Object.keys(raw).join(", ")
      );

      if (Array.isArray(raw.messages)) {
        return normalizeMessages(raw.messages);
      }
      if (raw.thread_id || raw.thread_guid) {
        console.log(
          "[lodgify-messages] Found thread ref:",
          raw.thread_id ?? raw.thread_guid
        );
        // Could try v2 messaging endpoint with this GUID
        const threadGuid = String(raw.thread_guid ?? raw.thread_id);
        return await fetchThreadMessages(threadGuid);
      }
    }
  } catch (err) {
    console.error("[lodgify-messages] Booking detail fallback error:", err);
  }

  return [];
}

/**
 * Fetch messages from the v2 messaging thread endpoint.
 */
async function fetchThreadMessages(
  threadGuid: string
): Promise<LodgifyMessage[]> {
  try {
    const res = await fetch(
      `${LODGIFY_BASE_URL}/v2/messaging/${threadGuid}`,
      {
        headers: {
          "X-ApiKey": getApiKey(),
          Accept: "application/json",
        },
      }
    );

    if (res.ok) {
      const raw = await res.json();
      console.log(
        "[lodgify-messages] Thread response shape:",
        JSON.stringify(raw).slice(0, 500)
      );

      // Thread may have a messages array or similar
      const messages = raw.messages ?? raw.items ?? raw.entries ?? [];
      if (Array.isArray(messages)) {
        return normalizeMessages(messages);
      }
    }
  } catch (err) {
    console.error("[lodgify-messages] Thread endpoint error:", err);
  }

  return [];
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
function normalizeMessages(raw: unknown): LodgifyMessage[] {
  const items = Array.isArray(raw) ? raw : [];
  return items.map((item: any, index: number) => normalizeMessage(item, index));
}

function normalizeMessage(raw: any, index: number): LodgifyMessage {
  return {
    id: String(raw.id ?? raw.Id ?? index),
    message: raw.message ?? raw.Message ?? raw.body ?? raw.Body ?? raw.text ?? "",
    subject: raw.subject ?? raw.Subject ?? "",
    type: raw.type ?? raw.Type ?? raw.sender_type ?? "Comment",
    created_at:
      raw.created_at ?? raw.CreatedAt ?? raw.date ?? raw.Date ?? raw.timestamp ?? "",
    sender_name:
      raw.sender_name ?? raw.SenderName ?? raw.sender ?? raw.from ?? raw.From ?? "",
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
