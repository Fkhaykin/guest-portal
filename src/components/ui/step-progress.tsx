import { cn } from "@/lib/utils";

/**
 * Wizard progress as filled segments, one per step, rather than a single thin
 * bar. Guests can see how many steps are left, which a percentage bar hides.
 *
 * Renders a labelled progress role for assistive tech; the segments
 * themselves are decorative.
 */
export function StepProgress({
  current,
  total,
  label,
  className,
}: {
  /** 1-based index of the step in progress. */
  current: number;
  total: number;
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current}
      aria-valuetext={label ?? `Step ${current} of ${total}`}
      data-slot="step-progress"
      className={cn("flex items-center gap-1.5", className)}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={cn(
            "h-1.5 flex-1 rounded-full transition-colors duration-300 ease-out-soft",
            i < current ? "bg-primary" : "bg-muted"
          )}
        />
      ))}
    </div>
  );
}
