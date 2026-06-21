import Link from "next/link";
import { AnalyticsCharts } from "@/components/admin/analytics-charts-lazy";
import { PageHeader } from "@/components/ui/page-header";

export default async function AdminDashboardPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Performance across all your properties at a glance."
      />

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
