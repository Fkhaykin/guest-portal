"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogOut, SprayCan, RefreshCw } from "lucide-react";
import { useState } from "react";

export function CleanerHeader({
  cleanerName,
  totalTasks,
  completedTasks,
}: {
  cleanerName: string;
  totalTasks: number;
  completedTasks: number;
}) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  async function handleLogout() {
    await fetch("/api/cleaner/logout", { method: "POST" });
    router.push("/cleaner/login");
  }

  function handleRefresh() {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 1000);
  }

  return (
    <header className="border-b bg-card sticky top-0 z-10">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-primary/10 p-2">
            <SprayCan className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm">{cleanerName}</p>
            <p className="text-xs text-muted-foreground">
              {completedTasks}/{totalTasks} tasks done
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={handleRefresh} title="Refresh">
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleLogout} title="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
