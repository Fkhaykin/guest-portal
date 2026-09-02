import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The wordmark. The asset is black-on-transparent, so it is inverted for
 * light mode and left alone in dark — a rule that was copy-pasted into six
 * files. Centralized here so swapping the asset (or shipping a real
 * light-mode variant) is a one-file change.
 */
const SIZES = {
  sm: "h-8",
  md: "h-9",
  lg: "h-12",
} as const;

export function Logo({
  size = "md",
  className,
  priority,
}: {
  size?: keyof typeof SIZES;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/logo.png"
      alt="Summit Lakeside Rentals"
      width={180}
      height={90}
      priority={priority}
      className={cn("w-auto invert dark:invert-0", SIZES[size], className)}
    />
  );
}
