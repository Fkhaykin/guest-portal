// Provider-agnostic SMS delivery. Chosen via SMS_PROVIDER (default "textbelt").
// Callers keep their own sms_log inserts and URL-stripping; this only talks to
// the provider and returns a normalized result. Switching to Twilio is a single
// env change once the account + A2P 10DLC registration are in place.
//
// Twilio note: unlike Textbelt, Twilio has no per-message reply payload, so an
// inbound reply is routed back by the sender's phone number (see the fallback in
// /api/sms/inbound), not by replyContext. replyContext is only used by Textbelt.

const PROVIDER = (process.env.SMS_PROVIDER ?? "textbelt").trim().toLowerCase();
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://guest.summitlakeside.com").replace(/\/+$/, "");

const TEXTBELT_KEY = process.env.TEXTBELT_API_KEY?.trim();
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID?.trim();
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN?.trim();
const TWILIO_MESSAGING_SERVICE_SID = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim();
const TWILIO_FROM = process.env.TWILIO_FROM_NUMBER?.trim();

export type SmsDelivery = {
  success: boolean;
  error?: string;
  quotaRemaining?: number | null; // Textbelt only; null under Twilio (usage-billed)
  providerId?: string | null;     // Textbelt textId or Twilio message SID
};

export type SmsSendOptions = {
  // Registration id attached so inbound replies can be routed back. Used only by
  // Textbelt (webhookData); Twilio routes replies by phone number instead.
  replyContext?: string;
};

export async function deliverSms(
  to: string,
  message: string,
  opts: SmsSendOptions = {}
): Promise<SmsDelivery> {
  if (PROVIDER === "twilio") return sendViaTwilio(to, message);
  return sendViaTextbelt(to, message, opts);
}

async function sendViaTextbelt(
  to: string,
  message: string,
  opts: SmsSendOptions
): Promise<SmsDelivery> {
  if (!TEXTBELT_KEY) return { success: false, error: "TEXTBELT_API_KEY not configured" };

  const payload: Record<string, unknown> = { phone: to, message, key: TEXTBELT_KEY };
  if (opts.replyContext) {
    payload.replyWebhookUrl = `${APP_URL}/api/sms/inbound`;
    payload.webhookData = opts.replyContext;
  }

  try {
    const res = await fetch("https://textbelt.com/text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      error?: string;
      quotaRemaining?: number;
      textId?: number | string;
    };
    return {
      success: data.success === true,
      error: data.error,
      quotaRemaining: typeof data.quotaRemaining === "number" ? data.quotaRemaining : null,
      providerId: data.textId != null ? String(data.textId) : null,
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Textbelt request failed" };
  }
}

async function sendViaTwilio(to: string, message: string): Promise<SmsDelivery> {
  if (!TWILIO_SID || !TWILIO_TOKEN || (!TWILIO_MESSAGING_SERVICE_SID && !TWILIO_FROM)) {
    return { success: false, error: "Twilio not configured (need SID, auth token, and a messaging service or from number)" };
  }

  const params = new URLSearchParams();
  params.set("To", to);
  // A Messaging Service (recommended for A2P 10DLC) picks the sending number and
  // applies the registered campaign; a bare From number is the fallback.
  if (TWILIO_MESSAGING_SERVICE_SID) params.set("MessagingServiceSid", TWILIO_MESSAGING_SERVICE_SID);
  else params.set("From", TWILIO_FROM!);
  params.set("Body", message);

  const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString("base64");

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      }
    );
    const data = (await res.json().catch(() => ({}))) as {
      sid?: string;
      status?: string;
      error_code?: number | null;
      error_message?: string | null;
      message?: string;
    };
    // Twilio returns 201 with a SID on accept; a 4xx carries `message`/`error_message`.
    if (res.ok && data.sid && data.status !== "failed") {
      return { success: true, quotaRemaining: null, providerId: data.sid };
    }
    return {
      success: false,
      error: data.error_message || data.message || `Twilio error ${res.status}`,
      quotaRemaining: null,
      providerId: data.sid ?? null,
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Twilio request failed" };
  }
}
