import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { IconTile } from "@/components/ui/icon-tile";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/status-styles";

/**
 * Dashboard metric card. The number is the point, so it leads the column and
 * the icon is demoted to a corner tile — the previous layout put a colored
 * square first and made every dashboard read as a row of badges.
 *
 * Defaults to the brand tone so dashboards stop looking like a bag of
 * Skittles. Use `tone` only where a status genuinely needs to read as
 * success/warning/danger.
 */
export function StatCard({
  icon: Icon,
  value,
  label,
  tone = "info",
  hint,
  className,
}: {
  icon: LucideIcon;
  value: React.ReactNode;
  label: React.ReactNode;
  tone?: Tone;
  hint?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "transition-[transform,box-shadow] duration-200 ease-out-soft hover:shadow-raised",
        className
      )}
    >
      <CardContent className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="truncate text-[13px] text-muted-foreground">{label}</div>
          <div className="text-[26px] font-semibold leading-none tracking-tight tabular-nums">
            {value}
          </div>
          {hint && <div className="pt-0.5 text-xs text-muted-foreground/80">{hint}</div>}
        </div>
        <IconTile icon={Icon} tone={tone} className="size-9 rounded-lg" />
      </CardContent>
    </Card>
  );
}
