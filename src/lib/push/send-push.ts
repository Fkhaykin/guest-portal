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

/**
 * Send a web push notification to every device subscribed for the given
 * owner. Dead subscriptions (404/410 from the push service) are deleted.
 */
async function sendPushTo(
  ownerColumn: "cleaner_id" | "host_id",
  ownerId: string,
  payload: PushPayload
) {
  if (!ensureConfigured()) {
    console.log("[push] VAPID keys not configured, skipping notification");
    return;
  }

  const supabase = createAdminClient();
  const { data: subscriptions } = await supabase
    .from("push_subscription")
    .select("id, endpoint, subscription")
    .eq(ownerColumn, ownerId);

  if (!subscriptions?.length) return;

  const body = JSON.stringify(payload);

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        // High urgency: iOS delivers normal-urgency pushes lazily (or drops
        // them in Low Power Mode); these are user-facing alerts, not syncs.
        await webpush.sendNotification(sub.subscription as PushSubscription, body, {
          urgency: "high",
        });
      } catch (err) {
        const statusCode = (err as WebPushError).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // Subscription expired or device unsubscribed — clean it up
          await supabase.from("push_subscription").delete().eq("id", sub.id);
        } else {
          console.error(
            `[push] Failed to send to ${ownerColumn}=${ownerId}:`,
            err instanceof Error ? err.message : err
          );
        }
      }
    })
  );
}

export async function sendPushToCleaner(
  cleanerId: string,
  payload: PushPayload
) {
  return sendPushTo("cleaner_id", cleanerId, payload);
}

export async function sendPushToHost(hostId: string, payload: PushPayload) {
  return sendPushTo("host_id", hostId, payload);
}
