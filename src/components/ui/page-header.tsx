import { cn } from "@/lib/utils";

/**
 * Consistent page header for app surfaces (admin / cleaner / guest portal).
 * Replaces the grab-bag of `text-xl` / `text-lg` / `text-2xl` / `text-3xl`
 * one-off headings with a single rhythm. Pass `actions` for trailing buttons.
 *
 * `eyebrow` is the section a page belongs to ("Operations", "Deliveries") —
 * it gives a stack of otherwise-identical admin pages a sense of place.
 * Guest pages reach for drama by passing
 * `titleClassName="font-display text-display"`.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
  titleClassName,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  titleClassName?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="min-w-0 space-y-1">
        {eyebrow && (
          <p className="text-eyebrow text-muted-foreground">{eyebrow}</p>
        )}
        <h1
          className={cn(
            "text-xl sm:text-2xl font-semibold tracking-tight text-balance",
            titleClassName
          )}
        >
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground text-pretty">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
