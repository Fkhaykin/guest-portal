import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { NotificationSettings } from "@/components/admin/notification-settings";
import { Building2, SprayCan, Webhook, ChevronRight } from "lucide-react";

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
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="management">Management</TabsTrigger>
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

        <TabsContent value="management">
          <Card>
            <CardContent className="p-0 divide-y">
              <Link
                href="/admin/properties"
                className="flex items-center gap-3 p-4 hover:bg-accent/50 transition-colors"
              >
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="font-medium">Properties</p>
                  <p className="text-sm text-muted-foreground">Manage listings, content, and QR codes</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
              <Link
                href="/admin/cleaners"
                className="flex items-center gap-3 p-4 hover:bg-accent/50 transition-colors"
              >
                <SprayCan className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="font-medium">Cleaners</p>
                  <p className="text-sm text-muted-foreground">Manage cleaner accounts and assignments</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
              <Link
                href="/admin/lodgify-webhooks"
                className="flex items-center gap-3 p-4 hover:bg-accent/50 transition-colors"
              >
                <Webhook className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="font-medium">Lodgify Webhooks</p>
                  <p className="text-sm text-muted-foreground">View incoming booking sync events</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
