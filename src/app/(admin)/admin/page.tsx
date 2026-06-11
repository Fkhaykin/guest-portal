import Link from "next/link";
import { AnalyticsCharts } from "@/components/admin/analytics-charts";

export default async function AdminDashboardPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>

      <AnalyticsCharts />

      <div>
        <Link
          href="/admin/settings?tab=properties"
          className="text-sm font-medium text-primary hover:underline"
        >
          Manage your properties →
        </Link>
      </div>
    </div>
  );
}
