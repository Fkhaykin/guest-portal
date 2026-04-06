import Link from "next/link";
import { AnalyticsCharts } from "@/components/admin/analytics-charts";

export default async function AdminDashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Analytics from your Lodgify bookings
        </p>
      </div>

      <AnalyticsCharts />

      <div>
        <Link
          href="/admin/properties"
          className="text-sm font-medium text-primary hover:underline"
        >
          Manage your properties →
        </Link>
      </div>
    </div>
  );
}
