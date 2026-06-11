import { createAdminClient } from "@/lib/supabase/admin";
import { evaluateSegment } from "./segments";
import { sendCampaignStep, type SendResult } from "./send";
import type { Tables, SegmentFilter } from "@/types/database";

type ActiveCampaign = Tables<"marketing_campaign">;
type Step = Tables<"marketing_campaign_step">;

export type CronRunSummary = {
  campaigns_processed: number;
  steps_fired: number;
  totals: SendResult;
};

/**
 * Process all active drip campaigns. For each step in each campaign, find guests
 * whose last check_out_date + step.delay_days_after_checkout == today, and send.
 */
export async function processDripCampaigns(): Promise<CronRunSummary> {
  const supabase = createAdminClient();
  const summary: CronRunSummary = {
    campaigns_processed: 0,
    steps_fired: 0,
    totals: {
      sent: 0,
      skipped_capped: 0,
      skipped_no_channel: 0,
      skipped_already_sent: 0,
      failed: 0,
    },
  };

  const { data: campaigns, error } = await supabase
    .from("marketing_campaign")
    .select("*")
    .eq("kind", "drip")
    .eq("status", "active");

  if (error) {
    console.error("[marketing.cron] failed to load campaigns:", error);
    return summary;
  }

  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);

  for (const campaign of (campaigns ?? []) as ActiveCampaign[]) {
    if (!campaign.segment_id) continue;

    const { data: segmentRow } = await supabase
      .from("guest_segment")
      .select("filter")
      .eq("id", campaign.segment_id)
      .single();

    if (!segmentRow) continue;

    const baseFilter = (segmentRow.filter ?? {}) as SegmentFilter;

    const { data: steps } = await supabase
      .from("marketing_campaign_step")
      .select("*")
      .eq("campaign_id", campaign.id)
      .order("step_order");

    if (!steps || steps.length === 0) continue;
    summary.campaigns_processed++;

    // Evaluate the segment once per campaign; each step filters by last_check_out.
    const allMembers = await evaluateSegment(campaign.host_id, baseFilter);

    for (const step of steps as Step[]) {
      if (step.delay_days_after_checkout == null) continue;

      const target = new Date(today);
      target.setUTCDate(target.getUTCDate() - step.delay_days_after_checkout);
      const targetIso = target.toISOString().slice(0, 10);

      // Fire only for guests whose MOST RECENT stay's check_out is the target date.
      const members = allMembers.filter((m) => m.last_check_out === targetIso);
      if (members.length === 0) continue;

      const res = await sendCampaignStep(campaign, step, members);
      summary.steps_fired++;
      summary.totals.sent += res.sent;
      summary.totals.skipped_capped += res.skipped_capped;
      summary.totals.skipped_no_channel += res.skipped_no_channel;
      summary.totals.skipped_already_sent += res.skipped_already_sent;
      summary.totals.failed += res.failed;
    }
  }

  console.log(`[marketing.cron] ${todayIso} processed:`, summary);
  return summary;
}
