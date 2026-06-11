import { createClient, getAuthenticatedUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CampaignsPageShell } from "@/components/admin/marketing/campaigns-page-shell";

export default async function CampaignsPage() {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);
  if (!user) redirect("/auth/login");

  const { data: host } = await supabase
    .from("host")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!host) redirect("/auth/login");

  const { data: properties } = await supabase
    .from("property")
    .select("id, name, nickname")
    .eq("host_id", host.id)
    .order("sort_order", { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Campaigns</h1>
        <p className="text-muted-foreground">
          Send targeted messages and automated drips to past guests.
        </p>
      </div>
      <CampaignsPageShell properties={properties ?? []} />
    </div>
  );
}
