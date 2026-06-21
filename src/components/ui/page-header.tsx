import { cn } from "@/lib/utils";

/**
 * Consistent page header for app surfaces (admin / cleaner / guest portal).
 * Replaces the grab-bag of `text-xl` / `text-lg` / `text-2xl` / `text-3xl`
 * one-off headings with a single rhythm. Pass `actions` for trailing buttons.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-balance">
          {title}
        </h1>
        {description && (
          <p className="text-sm sm:text-base text-muted-foreground text-pretty">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
