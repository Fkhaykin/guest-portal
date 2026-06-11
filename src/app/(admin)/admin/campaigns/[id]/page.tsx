import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient, getAuthenticatedUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { evaluateSegment } from "@/lib/marketing/segments";
import { CampaignComposer } from "@/components/admin/marketing/campaign-composer";
import { CampaignSendsLog } from "@/components/admin/marketing/campaign-sends-log";
import { buttonVariants } from "@/components/ui/button-variants";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft } from "lucide-react";
import type { SegmentFilter, CampaignChannel, Tables } from "@/types/database";

export default async function CampaignDetailPage(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);
  if (!user) redirect("/auth/login");

  const { data: host } = await supabase
    .from("host")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!host) redirect("/auth/login");

  const admin = createAdminClient();
  const { data: campaign } = await admin
    .from("marketing_campaign")
    .select("*")
    .eq("id", id)
    .eq("host_id", host.id)
    .maybeSingle();
  if (!campaign) notFound();

  const { data: steps } = await admin
    .from("marketing_campaign_step")
    .select("*")
    .eq("campaign_id", id)
    .order("step_order");

  const { data: segmentRows } = await admin
    .from("guest_segment")
    .select("*")
    .eq("host_id", host.id)
    .order("created_at", { ascending: false });

  const segments = await Promise.all(
    (segmentRows ?? []).map(async (s) => {
      const members = await evaluateSegment(host.id, s.filter as SegmentFilter);
      return {
        id: s.id,
        name: s.name,
        member_count: members.length,
        reachable_email: members.filter((m) => m.email).length,
        reachable_sms: members.filter((m) => m.phone).length,
      };
    })
  );

  const c = campaign as Tables<"marketing_campaign">;
  const initial = {
    id: c.id,
    name: c.name,
    kind: c.kind,
    segment_id: c.segment_id ?? "",
    default_channel: c.default_channel as CampaignChannel,
    send_cap_days: c.send_cap_days,
    discount_code: c.discount_code,
    direct_book_url: c.direct_book_url,
    status: c.status,
    steps: (steps ?? []).map((s) => ({
      id: s.id,
      delay_days_after_checkout: s.delay_days_after_checkout,
      subject: s.subject ?? "",
      html_body: s.html_body ?? "",
      text_body: s.text_body ?? "",
      channel_override: s.channel_override as CampaignChannel | null,
    })),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/campaigns" className={buttonVariants({ variant: "ghost", size: "icon" })}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{campaign.name}</h1>
          <p className="text-sm text-muted-foreground">Status: {campaign.status}</p>
        </div>
      </div>

      <Tabs defaultValue="editor">
        <TabsList>
          <TabsTrigger value="editor">Editor</TabsTrigger>
          <TabsTrigger value="log">Send log</TabsTrigger>
        </TabsList>
        <TabsContent value="editor" className="mt-4">
          <CampaignComposer segments={segments} initial={initial} />
        </TabsContent>
        <TabsContent value="log" className="mt-4">
          <CampaignSendsLog campaignId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
