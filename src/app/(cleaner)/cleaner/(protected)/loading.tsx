import { Skeleton } from "@/components/ui/skeleton";

// Instant fallback while a cleaner page segment loads. Sidebar stays; only the
// main content area shows the skeleton.
export default function CleanerLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
