"use client";

import { useState } from "react";
import {
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type DatePreset =
  | "30d"
  | "90d"
  | "6m"
  | "1y"
  | "ytd"
  | "lastyear"
  | "all"
  | "custom";

// "Last" presets are rolling windows ending today; "Periods" are calendar
// periods (YTD, the previous complete year, or everything).
const PRESET_GROUPS: {
  label: string;
  options: { value: DatePreset; label: string }[];
}[] = [
  {
    label: "Last",
    options: [
      { value: "30d", label: "Last 30 days" },
      { value: "90d", label: "Last 90 days" },
      { value: "6m", label: "Last 6 months" },
      { value: "1y", label: "Last 12 months" },
    ],
  },
  {
    label: "Periods",
    options: [
      { value: "ytd", label: "Year to date" },
      { value: "lastyear", label: "Last year" },
      { value: "all", label: "All time" },
    ],
  },
];

const PRESET_LABELS: Record<string, string> = Object.fromEntries(
  PRESET_GROUPS.flatMap((g) => g.options.map((o) => [o.value, o.label]))
);

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_HEADERS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function today(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

function toDateStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatShort(s: string): string {
  return parseDate(s).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function getPresetRange(preset: DatePreset): [Date | null, Date | null] {
  if (preset === "all" || preset === "custom") return [null, null];
  const now = today();
  if (preset === "ytd") return [new Date(now.getFullYear(), 0, 1), now];
  if (preset === "lastyear") {
    const y = now.getFullYear() - 1;
    return [new Date(y, 0, 1), new Date(y, 11, 31)];
  }
  const from = new Date(now);
  if (preset === "30d") from.setDate(from.getDate() - 30);
  else if (preset === "90d") from.setDate(from.getDate() - 90);
  else if (preset === "6m") from.setMonth(from.getMonth() - 6);
  else if (preset === "1y") from.setFullYear(from.getFullYear() - 1);
  return [from, now];
}

interface Props {
  preset: DatePreset;
  customFrom: string; // "YYYY-MM-DD" or ""
  customTo: string;
  onApply: (preset: DatePreset, from: string, to: string) => void;
}

// Single trigger button that opens a popover with grouped radio presets on one
// side and a two-month range calendar on the other. The selection is staged
// locally and only committed when the user presses Save, so the charts never
// re-filter mid-selection.
export function DateRangeFilter({ preset, customFrom, customTo, onApply }: Props) {
  const [open, setOpen] = useState(false);

  // Draft selection — committed to the parent only on Save.
  const [draftPreset, setDraftPreset] = useState<DatePreset>(preset);
  const [draftFrom, setDraftFrom] = useState(customFrom);
  const [draftTo, setDraftTo] = useState(customTo);
  const [viewMonth, setViewMonth] = useState(() => {
    const t = today();
    return new Date(t.getFullYear(), t.getMonth() - 1, 1);
  });

  const triggerLabel =
    preset === "custom" && customFrom && customTo
      ? `${formatShort(customFrom)} – ${formatShort(customTo)}`
      : PRESET_LABELS[preset] ?? "Date range";

  function handleOpenChange(next: boolean) {
    if (next) {
      // Re-seed the draft from the applied values each time the popover opens.
      setDraftPreset(preset);
      const [from, to] =
        preset === "custom" ? [customFrom, customTo] : resolvePreset(preset);
      setDraftFrom(from);
      setDraftTo(to);
      const anchor = from ? parseDate(from) : today();
      setViewMonth(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
    }
    setOpen(next);
  }

  function resolvePreset(p: DatePreset): [string, string] {
    const [from, to] = getPresetRange(p);
    return [from ? toDateStr(from) : "", to ? toDateStr(to) : ""];
  }

  function handleSelectPreset(p: DatePreset) {
    setDraftPreset(p);
    const [from, to] = resolvePreset(p);
    setDraftFrom(from);
    setDraftTo(to);
    if (from) {
      const d = parseDate(from);
      setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  }

  function handleDayClick(dateStr: string) {
    setDraftPreset("custom");
    if (!draftFrom || (draftFrom && draftTo)) {
      setDraftFrom(dateStr);
      setDraftTo("");
    } else if (dateStr < draftFrom) {
      setDraftTo(draftFrom);
      setDraftFrom(dateStr);
    } else if (dateStr === draftFrom) {
      setDraftFrom("");
      setDraftTo("");
    } else {
      setDraftTo(dateStr);
    }
  }

  function handleSave() {
    onApply(
      draftPreset,
      draftPreset === "custom" ? draftFrom : "",
      draftPreset === "custom" ? draftTo : ""
    );
    setOpen(false);
  }

  const saveDisabled = draftPreset === "custom" && !(draftFrom && draftTo);

  function renderMonth(monthDate: Date) {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    return (
      <div className="w-60">
        <h3 className="text-center font-semibold text-xs mb-2">
          {MONTH_NAMES[month]} {year}
        </h3>
        <div className="grid grid-cols-7">
          {DAY_HEADERS.map((d) => (
            <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-1">
              {d}
            </div>
          ))}
          {cells.map((day, i) => {
            if (day === null) return <div key={`e-${i}`} className="h-8" />;
            const dateStr = toDateStr(new Date(year, month, day));
            const isStart = draftFrom === dateStr;
            const isEnd = draftTo === dateStr;
            const inRange =
              draftFrom && draftTo && dateStr > draftFrom && dateStr < draftTo;
            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => handleDayClick(dateStr)}
                className={[
                  "h-8 text-xs transition-colors cursor-pointer hover:bg-primary/10",
                  inRange ? "bg-primary/10" : "",
                  isStart ? "bg-primary text-primary-foreground rounded-l-md" : "",
                  isEnd ? "bg-primary text-primary-foreground rounded-r-md" : "",
                  isStart && !draftTo ? "rounded-md" : "",
                ].join(" ")}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-input bg-background text-xs font-medium hover:bg-accent hover:text-accent-foreground transition-colors min-w-0">
        <CalendarRange className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">{triggerLabel}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto max-w-[calc(100vw-1rem)] p-0 gap-0"
      >
        <div className="flex flex-col sm:flex-row">
          {/* Preset groups */}
          <div className="p-3 sm:border-r border-b sm:border-b-0 sm:w-40 shrink-0">
            {PRESET_GROUPS.map((group) => (
              <div key={group.label} className="mb-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-1">
                  {group.label}
                </p>
                {group.options.map((option) => (
                  <PresetRow
                    key={option.value}
                    label={option.label}
                    checked={draftPreset === option.value}
                    onClick={() => handleSelectPreset(option.value)}
                  />
                ))}
              </div>
            ))}
            <PresetRow
              label="Custom"
              checked={draftPreset === "custom"}
              onClick={() => setDraftPreset("custom")}
            />
          </div>

          {/* Calendars */}
          <div className="p-3">
            <div className="flex items-center justify-between mb-1">
              <button
                type="button"
                onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}
                className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-accent"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
                className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-accent"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="flex gap-4">
              {renderMonth(viewMonth)}
              <div className="hidden md:block">
                {renderMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end border-t p-2">
          <Button size="sm" onClick={handleSave} disabled={saveDisabled}>
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function PresetRow({
  label,
  checked,
  onClick,
}: {
  label: string;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-xs hover:bg-accent transition-colors"
    >
      <span
        className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${
          checked ? "border-primary" : "border-muted-foreground/40"
        }`}
      >
        {checked && <span className="h-2 w-2 rounded-full bg-primary" />}
      </span>
      {label}
    </button>
  );
}
