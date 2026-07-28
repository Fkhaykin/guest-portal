import webpush, { type PushSubscription, type WebPushError } from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY?.trim();
const VAPID_SUBJECT = process.env.VAPID_SUBJECT?.trim() || "mailto:fkhaykin@gmail.com";

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  configured = true;
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

/** Delivery tally so callers can tell a real send from a no-op or a dead fan-out. */
export type PushResult = {
  /** Subscriptions we attempted (0 = nothing to deliver to). */
  total: number;
  /** Accepted by the push service. */
  sent: number;
  /** Attempted but errored (excluding pruned dead subscriptions). */
  failed: number;
};

/**
 * Send a web push notification to every device subscribed for the given
 * owner. Dead subscriptions (404/410 from the push service) are deleted.
 * Returns a delivery tally: total=0 means there was nothing to deliver to,
 * total>0 with sent=0 means every live device failed (e.g. the request was
 * frozen mid-send) — the caller should treat that as a failure worth retrying.
 */
async function sendPushTo(
  ownerColumn: "cleaner_id" | "host_id",
  ownerId: string,
  payload: PushPayload
): Promise<PushResult> {
  if (!ensureConfigured()) {
    console.log("[push] VAPID keys not configured, skipping notification");
    return { total: 0, sent: 0, failed: 0 };
  }

  const supabase = createAdminClient();
  const { data: subscriptions } = await supabase
    .from("push_subscription")
    .select("id, endpoint, subscription")
    .eq(ownerColumn, ownerId);

  if (!subscriptions?.length) return { total: 0, sent: 0, failed: 0 };

  const body = JSON.stringify(payload);

  const outcomes = await Promise.all(
    subscriptions.map(async (sub): Promise<"sent" | "failed" | "pruned"> => {
      try {
        // High urgency: iOS delivers normal-urgency pushes lazily (or drops
        // them in Low Power Mode); these are user-facing alerts, not syncs.
        await webpush.sendNotification(sub.subscription as PushSubscription, body, {
          urgency: "high",
        });
        return "sent";
      } catch (err) {
        const statusCode = (err as WebPushError).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // Subscription expired or device unsubscribed — clean it up
          await supabase.from("push_subscription").delete().eq("id", sub.id);
          return "pruned";
        }
        console.error(
          `[push] Failed to send to ${ownerColumn}=${ownerId}:`,
          err instanceof Error ? err.message : err
        );
        return "failed";
      }
    })
  );

  return {
    total: outcomes.length,
    sent: outcomes.filter((o) => o === "sent").length,
    failed: outcomes.filter((o) => o === "failed").length,
  };
}

export async function sendPushToCleaner(
  cleanerId: string,
  payload: PushPayload
): Promise<PushResult> {
  return sendPushTo("cleaner_id", cleanerId, payload);
}

export async function sendPushToHost(hostId: string, payload: PushPayload): Promise<PushResult> {
  return sendPushTo("host_id", hostId, payload);
}
