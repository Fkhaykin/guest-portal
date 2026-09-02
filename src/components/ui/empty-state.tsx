import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Consistent empty state: a tinted icon medallion, a title, supporting copy,
 * and optional action. Replaces the bare `<p>No X.</p>` lines scattered across
 * the app that read as unfinished.
 *
 * The dashed border is gone on purpose — a dashed box reads as a drop target
 * or a placeholder someone forgot to finish. A soft filled panel with a
 * hairline reads as a deliberate state.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl bg-muted/40 px-6 py-14 text-center ring-1 ring-foreground/[0.04]",
        className
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-b from-primary/15 to-primary/5">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground text-pretty">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
