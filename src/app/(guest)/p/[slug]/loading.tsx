import { Skeleton } from "@/components/ui/skeleton";

// Instant fallback while a guest-portal page segment loads. The property header
// and bottom nav (rendered by the layout) stay; only this content swaps.
export default function GuestPortalLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-7 w-40" />
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
