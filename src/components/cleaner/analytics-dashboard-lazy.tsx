"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// recharts is heavy (~100kb+). Load it lazily, client-side only, so the cleaner
// dashboard shell paints immediately and the charts stream in afterward. Props
// are inferred from the underlying component.
export const AnalyticsDashboard = dynamic(
  () => import("./analytics-dashboard").then((m) => m.AnalyticsDashboard),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    ),
  }
);
