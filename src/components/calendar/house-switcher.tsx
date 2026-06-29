"use client";

import { useRouter } from "next/navigation";
import { ChevronsUpDown } from "lucide-react";

interface Props {
  houses: { index: number; label: string }[];
  current: number;
}

// Bottom-of-page selector to jump between house calendars.
export function HouseSwitcher({ houses, current }: Props) {
  const router = useRouter();
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">Switch house</span>
      <div className="relative mt-1.5">
        <select
          value={current}
          onChange={(e) => router.push(`/calendar?house=${e.target.value}`)}
          className="w-full appearance-none rounded-lg border bg-card px-3 py-2.5 pr-9 text-sm font-medium shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {houses.map((h) => (
            <option key={h.index} value={h.index}>
              {h.label}
            </option>
          ))}
        </select>
        <ChevronsUpDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      </div>
    </label>
  );
}
