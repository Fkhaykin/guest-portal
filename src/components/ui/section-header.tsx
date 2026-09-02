import { cn } from "@/lib/utils";

/**
 * Heading for a section *within* a page — one rung below PageHeader. Carries
 * an optional eyebrow and a trailing action ("See all"), which is the shape
 * every guest-portal section was hand-rolling.
 */
export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  className,
  titleClassName,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  titleClassName?: string;
}) {
  return (
    <div className={cn("flex items-end justify-between gap-4", className)}>
      <div className="min-w-0 space-y-1">
        {eyebrow && <p className="text-eyebrow text-muted-foreground">{eyebrow}</p>}
        <h2 className={cn("text-title font-semibold", titleClassName)}>{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground text-pretty">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0 text-sm">{action}</div>}
    </div>
  );
}
