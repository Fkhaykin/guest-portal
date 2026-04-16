"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  SkipForward,
} from "lucide-react";
import type { ReactNode } from "react";

type TabCategory = {
  key: string;
  label: string;
  icon: ReactNode;
  count: number;
  cards: ReactNode;
  empty: string;
};

export function TasksTabs({
  categories,
  defaultTab,
}: {
  categories: TabCategory[];
  defaultTab: string;
}) {
  const visibleTabs = categories.filter((c) => c.count > 0 || c.key === defaultTab);

  if (visibleTabs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No reservations to show right now.
      </div>
    );
  }

  return (
    <Tabs defaultValue={defaultTab}>
      <TabsList className="w-full overflow-x-auto">
        {visibleTabs.map((tab) => (
          <TabsTrigger key={tab.key} value={tab.key} className="gap-1.5 text-xs sm:text-sm">
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 min-w-5 h-4 flex items-center justify-center">
              {tab.count}
            </Badge>
          </TabsTrigger>
        ))}
      </TabsList>

      {visibleTabs.map((tab) => (
        <TabsContent key={tab.key} value={tab.key}>
          {tab.count > 0 ? (
            <div className="space-y-3">{tab.cards}</div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              {tab.empty}
            </div>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}
