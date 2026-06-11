import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { evaluateSegment } from "@/lib/marketing/segments";
import { CampaignComposer } from "@/components/admin/marketing/campaign-composer";
import { buttonVariants } from "@/components/ui/button-variants";
import { ArrowLeft } from "lucide-react";
import type { SegmentFilter } from "@/types/database";

export default async function NewCampaignPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: host } = await supabase
    .from("host")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!host) redirect("/auth/login");

  const admin = createAdminClient();
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/campaigns" className={buttonVariants({ variant: "ghost", size: "icon" })}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New campaign</h1>
        </div>
      </div>

      {segments.length === 0 ? (
        <div className="rounded-md border bg-muted/30 p-6 text-center">
          <p className="text-sm">You need a segment first.</p>
          <Link href="/admin/campaigns?tab=segments" className={buttonVariants({ className: "mt-3" })}>
            Create a segment
          </Link>
        </div>
      ) : (
        <CampaignComposer segments={segments} />
      )}
    </div>
  );
}
