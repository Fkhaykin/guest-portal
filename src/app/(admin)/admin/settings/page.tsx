import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { NotificationSettings } from "@/components/admin/notification-settings";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: host } = await supabase
    .from("host")
    .select("*")
    .eq("auth_user_id", user?.id ?? "")
    .single();

  const tabLinkClass =
    "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground";

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <Link href="/admin/properties" className={tabLinkClass}>
            Properties
          </Link>
          <Link href="/admin/cleaners" className={tabLinkClass}>
            Cleaners
          </Link>
          <Link href="/admin/lodgify-webhooks" className={tabLinkClass}>
            Lodgify Webhooks
          </Link>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <span className="text-sm text-muted-foreground">Name</span>
                <p className="font-medium">{host?.full_name}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Email</span>
                <p className="font-medium">{host?.email}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationSettings
            hostId={host?.id ?? ""}
            initialSettings={host?.notification_settings ?? null}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
