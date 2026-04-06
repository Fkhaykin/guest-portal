import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, CreditCard, QrCode } from "lucide-react";
import { AnalyticsCharts } from "@/components/admin/analytics-charts";

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const hostResult = await supabase
    .from("host")
    .select()
    .single();

  const hostId = (hostResult.data as { id: string } | null)?.id ?? "";

  const { count: propertyCount } = await supabase
    .from("property")
    .select("*", { count: "exact", head: true })
    .eq("host_id", hostId);

  const { data: propertyIds } = await supabase
    .from("property")
    .select("id")
    .eq("host_id", hostId);

  const pIds = propertyIds?.map((p) => p.id) ?? [];

  const { count: activeRegCount } = await supabase
    .from("registration")
    .select("*", { count: "exact", head: true })
    .in("property_id", pIds.length > 0 ? pIds : [""])
    .eq("status", "active");

  const { data: completedPayments } = await supabase
    .from("payment")
    .select("amount_cents")
    .eq("status", "completed");

  const totalRevenue = (completedPayments ?? []).reduce(
    (sum, p) => sum + p.amount_cents,
    0
  );

  const { data: qrCodes } = await supabase
    .from("qr_code")
    .select("scan_count")
    .in("property_id", pIds.length > 0 ? pIds : [""]);

  const totalScans = (qrCodes ?? []).reduce((sum, q) => sum + q.scan_count, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Manage your properties and guest experience
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Properties</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{propertyCount ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Active Registrations
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeRegCount ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(totalRevenue / 100).toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">QR Scans</CardTitle>
            <QrCode className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalScans.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      <div>
        <Link
          href="/admin/properties"
          className="text-sm font-medium text-primary hover:underline"
        >
          Manage your properties →
        </Link>
      </div>

      <div>
        <h2 className="text-xl font-semibold tracking-tight mb-4">Analytics</h2>
        <AnalyticsCharts />
      </div>
    </div>
  );
}
