"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function SyncBookingsButton() {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<{ newCount: number } | null>(null);
  const router = useRouter();

  async function handleSync() {
    setSyncing(true);
    setResult(null);
    try {
      const res = await fetch("/api/lodgify/refresh", { method: "POST" });
      const data = await res.json();
      const newCount = data.newIds?.length ?? 0;
      setResult({ newCount });
      if (newCount > 0) {
        // Store new IDs in sessionStorage so cards can highlight themselves
        sessionStorage.setItem("newRegistrationIds", JSON.stringify(data.newIds));
        router.refresh();
      }
    } catch {
      // silently fail
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleSync}
        disabled={syncing}
        className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
      >
        <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
        {syncing ? "Syncing..." : "Refresh"}
      </button>
      {result && !syncing && (
        <span className="text-xs text-muted-foreground">
          {result.newCount > 0
            ? `${result.newCount} new booking${result.newCount > 1 ? "s" : ""} imported`
            : "Everything up to date"}
        </span>
      )}
    </div>
  );
}
