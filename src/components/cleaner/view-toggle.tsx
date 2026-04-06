"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { List, CalendarDays } from "lucide-react";

export function ViewToggle({
  listView,
  calendarView,
}: {
  listView: React.ReactNode;
  calendarView: React.ReactNode;
}) {
  const [view, setView] = useState<"list" | "calendar">("list");

  return (
    <>
      <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
        <Button
          variant={view === "list" ? "default" : "ghost"}
          size="sm"
          className="h-7 px-3 text-xs gap-1.5"
          onClick={() => setView("list")}
        >
          <List className="h-3.5 w-3.5" />
          List
        </Button>
        <Button
          variant={view === "calendar" ? "default" : "ghost"}
          size="sm"
          className="h-7 px-3 text-xs gap-1.5"
          onClick={() => setView("calendar")}
        >
          <CalendarDays className="h-3.5 w-3.5" />
          Calendar
        </Button>
      </div>

      {view === "list" ? listView : calendarView}
    </>
  );
}
