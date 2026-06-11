import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { interpolateTokens, splitName, formatTokenDate, htmlToPlain } from "./tokens";
import type { SegmentMember } from "./segments";
import type {
  CampaignChannel,
  CampaignSendChannel,
  CampaignTokenVars,
  Tables,
} from "@/types/database";

const TEXTBELT_KEY = process.env.TEXTBELT_API_KEY?.trim();
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://guest.summitlakeside.com";

type Campaign = Pick<
  Tables<"marketing_campaign">,
  "id" | "host_id" | "default_channel" | "send_cap_days" | "discount_code" | "direct_book_url"
>;
type Step = Pick<
  Tables<"marketing_campaign_step">,
  "id" | "subject" | "html_body" | "text_body" | "channel_override"
>;
type HostMarketingConfig = {
  marketing_send_cap_days: number;
  marketing_from_email: string | null;
  marketing_from_name: string | null;
};

export function buildTokenVars(
  member: SegmentMember,
  campaign: Pick<Campaign, "discount_code" | "direct_book_url">
): CampaignTokenVars {
  const { first, last } = splitName(member.full_name);
  return {
    first_name: first,
    last_name: last,
    full_name: member.full_name,
    property_name: member.last_property_name,
    property_address: member.last_property_address ?? "",
    last_check_in: formatTokenDate(member.last_check_in),
    last_check_out: formatTokenDate(member.last_check_out),
    stay_count: String(member.stay_count),
    discount_code: campaign.discount_code ?? "",
    direct_book_link: campaign.direct_book_url ?? APP_URL,
  };
}

export function resolveChannel(
  campaignDefault: CampaignChannel,
  stepOverride: CampaignChannel | null,
  member: SegmentMember
): CampaignSendChannel | null {
  const preference = stepOverride ?? campaignDefault;
  if (preference === "sms") return member.phone ? "sms" : null;
  if (preference === "email") return member.email ? "email" : null;
  // auto: SMS first if phone present, else email
  if (member.phone) return "sms";
  if (member.email) return "email";
  return null;
}

/**
 * Check whether this guest has been sent any marketing message in the last N days.
 * Returns true if a send within cap_days exists (i.e. we should SKIP).
 */
async function isCapped(guestId: string, capDays: number): Promise<boolean> {
  if (capDays <= 0) return false;
  const supabase = createAdminClient();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - capDays);
  const { count, error } = await supabase
    .from("marketing_campaign_send")
    .select("id", { count: "exact", head: true })
    .eq("guest_id", guestId)
    .eq("status", "sent")
    .gte("sent_at", since.toISOString());
  if (error) {
    console.error("[marketing.send] cap check failed:", error);
    return false;
  }
  return (count ?? 0) > 0;
}

async function getHostMarketingConfig(hostId: string): Promise<HostMarketingConfig> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("host")
    .select("marketing_send_cap_days, marketing_from_email, marketing_from_name")
    .eq("id", hostId)
    .single();
  return {
    marketing_send_cap_days: data?.marketing_send_cap_days ?? 14,
    marketing_from_email: data?.marketing_from_email ?? null,
    marketing_from_name: data?.marketing_from_name ?? null,
  };
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text: string,
  hostConfig: HostMarketingConfig
): Promise<{ ok: boolean; error?: string; id?: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }
  const fromEmail = hostConfig.marketing_from_email || "contact@summitlakeside.com";
  const fromName = hostConfig.marketing_from_name || "Summit Lakeside";
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: `${fromName} <${fromEmail}>`,
    to,
    subject,
    html,
    text,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data?.id };
}

async function sendSms(
  phone: string,
  message: string
): Promise<{ ok: boolean; error?: string; id?: string }> {
  if (!TEXTBELT_KEY) return { ok: false, error: "TEXTBELT_API_KEY not configured" };
  const res = await fetch("https://textbelt.com/text", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, message, key: TEXTBELT_KEY }),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.success) return { ok: false, error: data.error ?? "Textbelt error" };
  return { ok: true, id: data.textId ? String(data.textId) : undefined };
}

export type SendResult = {
  sent: number;
  skipped_capped: number;
  skipped_no_channel: number;
  skipped_already_sent: number;
  failed: number;
};

/**
 * Send one step of a campaign to all members of a segment.
 * Idempotent: existing (campaign, step, guest) sends are skipped.
 */
export async function sendCampaignStep(
  campaign: Campaign,
  step: Step,
  members: SegmentMember[]
): Promise<SendResult> {
  const supabase = createAdminClient();
  const result: SendResult = {
    sent: 0,
    skipped_capped: 0,
    skipped_no_channel: 0,
    skipped_already_sent: 0,
    failed: 0,
  };

  const hostConfig = await getHostMarketingConfig(campaign.host_id);
  const capDays = campaign.send_cap_days ?? hostConfig.marketing_send_cap_days;

  // Pre-load existing sends for this campaign/step to skip in bulk
  const guestIds = members.map((m) => m.guest_id);
  const existingSet = new Set<string>();
  if (guestIds.length > 0) {
    const { data: existing } = await supabase
      .from("marketing_campaign_send")
      .select("guest_id")
      .eq("campaign_id", campaign.id)
      .eq("step_id", step.id)
      .in("guest_id", guestIds);
    for (const row of existing ?? []) existingSet.add(row.guest_id);
  }

  for (const member of members) {
    if (existingSet.has(member.guest_id)) {
      result.skipped_already_sent++;
      continue;
    }

    const channel = resolveChannel(campaign.default_channel, step.channel_override, member);
    if (!channel) {
      result.skipped_no_channel++;
      continue;
    }

    if (await isCapped(member.guest_id, capDays)) {
      result.skipped_capped++;
      await supabase.from("marketing_campaign_send").insert({
        campaign_id: campaign.id,
        step_id: step.id,
        guest_id: member.guest_id,
        registration_id: member.last_registration_id,
        channel,
        status: "skipped_capped",
        recipient: (channel === "sms" ? member.phone : member.email) ?? "",
        subject: step.subject,
        body: "",
        error: `Skipped: guest received another marketing message in last ${capDays} days`,
      });
      continue;
    }

    const vars = buildTokenVars(member, campaign);
    const subject = interpolateTokens(step.subject ?? "", vars);
    const html = step.html_body ? interpolateTokens(step.html_body, vars) : "";
    const text = step.text_body
      ? interpolateTokens(step.text_body, vars)
      : htmlToPlain(html);

    let sendOutcome: { ok: boolean; error?: string; id?: string };
    let body: string;
    let recipient: string;

    if (channel === "email") {
      recipient = member.email!;
      body = html || text;
      sendOutcome = await sendEmail(recipient, subject, html || `<p>${text}</p>`, text, hostConfig);
    } else {
      recipient = member.phone!;
      body = text;
      sendOutcome = await sendSms(recipient, text);
    }

    const insertRow = {
      campaign_id: campaign.id,
      step_id: step.id,
      guest_id: member.guest_id,
      registration_id: member.last_registration_id,
      channel,
      status: (sendOutcome.ok ? "sent" : "failed") as "sent" | "failed",
      recipient,
      subject: channel === "email" ? subject : null,
      body,
      sent_at: sendOutcome.ok ? new Date().toISOString() : null,
      error: sendOutcome.error ?? null,
      provider_message_id: sendOutcome.id ?? null,
    };

    const { error: insertError } = await supabase
      .from("marketing_campaign_send")
      .insert(insertRow);

    if (insertError) {
      // Likely a unique-constraint race; treat as already sent.
      result.skipped_already_sent++;
      continue;
    }

    if (sendOutcome.ok) result.sent++;
    else result.failed++;
  }

  return result;
}
