import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toneTile, type Tone } from "@/lib/status-styles";

/**
 * Dashboard metric card with a tinted icon tile, value, and label. Defaults to
 * the brand/primary tone so dashboards stop looking like a bag of Skittles
 * (amber + green + blue + purple + rose icon tiles). Use `tone` only where a
 * status genuinely needs to read as success/warning/danger.
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
    <Card className={cn("transition-shadow hover:shadow-sm", className)}>
      <CardContent className="flex items-center gap-3.5 p-4">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            toneTile(tone)
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-2xl font-bold leading-tight tracking-tight">
            {value}
          </div>
          <div className="truncate text-xs text-muted-foreground">{label}</div>
          {hint && <div className="mt-0.5 text-xs text-muted-foreground/80">{hint}</div>}
        </div>
      </CardContent>
    </Card>
  );
}
