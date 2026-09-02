import { cn } from "@/lib/utils";

/**
 * Standard content column. Admin/cleaner pages that are a stack of cards and
 * tables opt in so long pages stop stretching across a 2560px monitor; the
 * four heavy screens (messages inbox, reservation detail, analytics, the
 * calendar) deliberately do NOT — they need every pixel.
 */
export function PageContainer({
  width = "default",
  className,
  children,
}: {
  width?: "default" | "narrow" | "wide";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      data-slot="page-container"
      className={cn(
        "mx-auto w-full",
        width === "narrow" ? "max-w-3xl" : width === "wide" ? "max-w-7xl" : "max-w-6xl",
        className
      )}
    >
      {children}
    </div>
  );
}
