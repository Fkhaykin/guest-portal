import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";

// Direct (non-Lodgify) bookings get a synthetic thread keyed by registration
// id. Outbound messages go to the guest's email and/or phone; replies come
// back through /api/email/inbound (Resend) and /api/sms/inbound (Textbelt).

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isRegistrationId(param: string): boolean {
  return UUID_RE.test(param);
}

export function directThreadUid(registrationId: string): string {
  return `direct:${registrationId}`;
}

const FROM = "Summit Lakeside <contact@summitlakeside.com>";
// Inbound reply domain (Resend receiving). When unset, no thread reply-to is
// added and guest replies go to the From mailbox instead of the thread.
const REPLY_DOMAIN = process.env.DIRECT_REPLY_EMAIL_DOMAIN?.trim() || null;
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://guest.summitlakeside.com";

export function replyAddressFor(registrationId: string): string | null {
  return REPLY_DOMAIN ? `reply+${registrationId}@${REPLY_DOMAIN}` : null;
}

/** Extract the registration id from a reply+<uuid>@<domain> recipient. */
export function registrationIdFromReplyAddress(
  addresses: string[]
): string | null {
  for (const addr of addresses) {
    const match = addr.match(/reply\+([0-9a-f-]{36})@/i);
    if (match && UUID_RE.test(match[1])) return match[1].toLowerCase();
  }
  return null;
}

/** Cut the quoted history off an email reply, keeping just the new text. */
export function stripQuotedReply(text: string): string {
  const lines = text.split("\n");
  const cut = lines.findIndex(
    (line) =>
      /^On .{5,80} wrote:\s*$/.test(line.trim()) ||
      /^-{2,}\s*Original Message\s*-{2,}/i.test(line.trim()) ||
      /^From:\s.+@/.test(line.trim()) ||
      line.trim().startsWith(">")
  );
  const kept = cut === -1 ? lines : lines.slice(0, cut);
  return kept.join("\n").trim();
}

export type DirectMessageContext = {
  registrationId: string;
  guestName: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  propertyId: string | null;
  propertyName: string | null;
  checkInDate: string | null;
};

export async function loadDirectContext(
  registrationId: string
): Promise<DirectMessageContext | null> {
  const admin = createAdminClient();
  const { data: reg } = await admin
    .from("registration")
    .select(
      `id, property_id, check_in_date,
       guest:guest_id ( full_name, email, phone ),
       property:property_id ( name, nickname )`
    )
    .eq("id", registrationId)
    .maybeSingle();
  if (!reg) return null;

  const row = reg as unknown as {
    id: string;
    property_id: string | null;
    check_in_date: string | null;
    guest: { full_name: string | null; email: string | null; phone: string | null } | null;
    property: { name: string | null; nickname: string | null } | null;
  };
  return {
    registrationId: row.id,
    guestName: row.guest?.full_name ?? null,
    guestEmail: row.guest?.email ?? null,
    guestPhone: row.guest?.phone ?? null,
    propertyId: row.property_id,
    propertyName: row.property?.nickname || row.property?.name || null,
    checkInDate: row.check_in_date,
  };
}

/** Insert a message row and refresh the thread summary for a direct thread. */
export async function recordDirectMessage(params: {
  registrationId: string;
  type: "Owner" | "Renter";
  text: string;
  channel: "email" | "sms";
  guestName: string | null;
  createdAt?: string;
  incrementUnread?: boolean;
}): Promise<void> {
  const admin = createAdminClient();
  const threadUid = directThreadUid(params.registrationId);
  const createdAt = params.createdAt ?? new Date().toISOString();

  await admin.from("guest_message").insert({
    thread_uid: threadUid,
    registration_id: params.registrationId,
    message_type: params.type,
    channel: params.channel,
    message: params.text,
    guest_name: params.type === "Owner" ? null : params.guestName,
    creation_time: createdAt,
  });

  let unread = 0;
  if (params.incrementUnread) {
    const { data: thread } = await admin
      .from("guest_message_thread")
      .select("unread_count")
      .eq("thread_uid", threadUid)
      .maybeSingle();
    unread = (thread?.unread_count ?? 0) + 1;
  }

  await admin.from("guest_message_thread").upsert(
    {
      thread_uid: threadUid,
      registration_id: params.registrationId,
      guest_name: params.guestName,
      last_message_at: createdAt,
      last_message_preview: params.text.slice(0, 200),
      unread_count: unread,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "thread_uid" }
  );
}

/**
 * Send a host message for a direct booking: email when the guest has one
 * (with a reply-to that routes responses back into the thread), SMS as well
 * when they have a phone. Records the Owner message on success.
 */
export async function sendDirectGuestMessage(
  registrationId: string,
  text: string
): Promise<{ success: boolean; error?: string }> {
  const ctx = await loadDirectContext(registrationId);
  if (!ctx) return { success: false, error: "Registration not found" };
  if (!ctx.guestEmail && !ctx.guestPhone) {
    return { success: false, error: "Guest has no email or phone on file" };
  }

  const errors: string[] = [];
  let sentVia: "email" | "sms" | null = null;

  if (ctx.guestEmail) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const subject = ctx.propertyName
      ? `Your stay at ${ctx.propertyName}`
      : "About your reservation";
    const replyTo = replyAddressFor(registrationId);
    const { error } = await resend.emails.send({
      from: FROM,
      to: ctx.guestEmail,
      ...(replyTo ? { replyTo } : {}),
      subject,
      text: `${text}\n\n—\nSummit Lakeside · Reply to this email to respond.`,
    });
    if (error) errors.push(`email: ${error.message}`);
    else sentVia = "email";
  }

  if (ctx.guestPhone) {
    const key = process.env.TEXTBELT_API_KEY?.trim();
    if (!key) {
      if (!ctx.guestEmail) errors.push("sms: TEXTBELT_API_KEY not configured");
    } else {
      try {
        const res = await fetch("https://textbelt.com/text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: ctx.guestPhone,
            message: `Summit Lakeside: ${text}`,
            key,
            replyWebhookUrl: `${APP_URL}/api/sms/inbound`,
            webhookData: registrationId,
          }),
        });
        const data = (await res.json()) as { success?: boolean; error?: string };
        if (data.success) sentVia = sentVia ?? "sms";
        else errors.push(`sms: ${data.error ?? "unknown Textbelt error"}`);
      } catch (err) {
        errors.push(`sms: ${err instanceof Error ? err.message : "failed"}`);
      }
    }
  }

  if (!sentVia) {
    return { success: false, error: errors.join("; ") || "Send failed" };
  }

  await recordDirectMessage({
    registrationId,
    type: "Owner",
    text,
    channel: sentVia,
    guestName: ctx.guestName,
  });
  if (errors.length) {
    console.warn(`[direct-msg] Partial send for ${registrationId}:`, errors);
  }
  return { success: true };
}
