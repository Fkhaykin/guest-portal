"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronDown } from "lucide-react";

export function CollapsibleSection({
  title,
  icon,
  count,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="space-y-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full group"
      >
        <h2 className="text-base font-semibold flex items-center gap-2">
          {icon}
          {title}
        </h2>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {count}
          </Badge>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${
              open ? "" : "-rotate-90"
            }`}
          />
        </div>
      </button>
      {open && children}
    </section>
  );
}
