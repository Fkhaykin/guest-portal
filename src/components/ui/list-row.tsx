import { cn } from "@/lib/utils";

/**
 * Leading tile · title/subtitle · trailing meta. The sanctioned pattern for
 * the mobile half of every dual-render table, and for any list of records
 * that isn't a table.
 *
 * `min-w-0` on the middle column is load-bearing: without it a long guest
 * name pushes the trailing meta off the edge instead of truncating.
 */
export function ListRow({
  leading,
  title,
  subtitle,
  meta,
  trailing,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  leading?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  meta?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div
      data-slot="list-row"
      className={cn("flex items-center gap-3 px-4 py-3", className)}
      {...props}
    >
      {leading}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{title}</div>
        {subtitle && (
          <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
        )}
      </div>
      {meta && (
        <div className="shrink-0 text-right text-xs text-muted-foreground">{meta}</div>
      )}
      {trailing}
    </div>
  );
}
