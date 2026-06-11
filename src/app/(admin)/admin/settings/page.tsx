import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { SettingsTabs } from "@/components/admin/settings-tabs";
import { NotificationSettings } from "@/components/admin/notification-settings";
import { PropertiesSection } from "@/components/admin/properties-section";
import { CleanersSection } from "@/components/admin/cleaners-section";
import { LodgifyWebhooksSection } from "@/components/admin/lodgify-webhooks-section";

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account</p>
      </div>

      <SettingsTabs>
        <TabsContent value="profile">
          <Card className="max-w-2xl">
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
          <div className="max-w-2xl">
            <NotificationSettings
              hostId={host?.id ?? ""}
              initialSettings={host?.notification_settings ?? null}
            />
          </div>
        </TabsContent>

        <TabsContent value="properties">
          <PropertiesSection />
        </TabsContent>

        <TabsContent value="cleaners">
          <CleanersSection />
        </TabsContent>

        <TabsContent value="lodgify-webhooks">
          <LodgifyWebhooksSection />
        </TabsContent>
      </SettingsTabs>
    </div>
  );
}
