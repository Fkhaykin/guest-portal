"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// recharts is heavy (~100kb+). Load it lazily, client-side only, so the admin
// dashboard shell paints immediately and the charts stream in afterward.
export const AnalyticsCharts = dynamic(
  () => import("./analytics-charts").then((m) => m.AnalyticsCharts),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    ),
  }
);
