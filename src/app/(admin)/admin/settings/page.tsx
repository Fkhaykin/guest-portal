import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    </div>
  );
}
