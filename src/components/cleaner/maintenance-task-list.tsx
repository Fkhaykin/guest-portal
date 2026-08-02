"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, RotateCcw, Wrench } from "lucide-react";

export type MaintenanceTask = {
  id: string;
  description: string;
  source: string | null;
  status: "open" | "done";
  created_at: string;
  completed_at: string | null;
  propertyName: string;
};

function TaskCard({ task }: { task: MaintenanceTask }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const done = task.status === "done";

  async function setDone(next: boolean) {
    setBusy(true);
    try {
      const res = await fetch("/api/cleaner/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: task.id, done: next }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={done ? "opacity-70" : ""}>
      <CardContent className="flex items-start gap-3 p-4">
        <Wrench className={`h-4 w-4 mt-0.5 shrink-0 ${done ? "text-success" : "text-warning"}`} />
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">{task.propertyName}</Badge>
            {task.source && (
              <span className="text-[11px] text-muted-foreground">{task.source}</span>
            )}
          </div>
          <p className={`text-sm ${done ? "line-through text-muted-foreground" : ""}`}>
            {task.description}
          </p>
        </div>
        <button
          onClick={() => setDone(!done)}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent hover:text-accent-foreground disabled:opacity-50 shrink-0"
        >
          {done ? (
            <>
              <RotateCcw className="h-3.5 w-3.5" />
              Reopen
            </>
          ) : (
            <>
              <CheckCircle2 className="h-3.5 w-3.5" />
              Fixed
            </>
          )}
        </button>
      </CardContent>
    </Card>
  );
}

export function MaintenanceTaskList({ tasks }: { tasks: MaintenanceTask[] }) {
  const open = tasks.filter((t) => t.status === "open");
  const recentlyDone = tasks.filter((t) => t.status === "done");

  return (
    <div className="space-y-3">
      {open.map((t) => (
        <TaskCard key={t.id} task={t} />
      ))}
      {recentlyDone.length > 0 && (
        <>
          <p className="text-xs font-medium text-muted-foreground pt-2">Recently fixed</p>
          {recentlyDone.map((t) => (
            <TaskCard key={t.id} task={t} />
          ))}
        </>
      )}
    </div>
  );
}
