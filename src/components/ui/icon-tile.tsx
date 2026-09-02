import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { accentTile, toneTile, type Accent, type Tone } from "@/lib/status-styles";

/**
 * The tinted rounded square holding a lucide icon — the single most repeated
 * shape in the app (stat cards, quick links, checkin rows, empty states).
 * Extracted so the tint, radius and icon size stay in step everywhere.
 *
 * Pass `tone` when the color means something (success/warning/danger), or
 * `accent` when it's purely decorative variety. Passing neither gives the
 * brand tone.
 */
export function IconTile({
  icon: Icon,
  size = "md",
  tone,
  accent,
  className,
}: {
  icon: LucideIcon;
  size?: "sm" | "md" | "lg";
  tone?: Tone;
  accent?: Accent;
  className?: string;
}) {
  const box =
    size === "sm" ? "size-8 rounded-lg" : size === "lg" ? "size-12 rounded-2xl" : "size-10 rounded-xl";
  const glyph = size === "sm" ? "size-4" : size === "lg" ? "size-6" : "size-5";
  return (
    <div
      data-slot="icon-tile"
      className={cn(
        "flex shrink-0 items-center justify-center",
        box,
        accent ? accentTile(accent) : toneTile(tone ?? "info"),
        className
      )}
    >
      <Icon className={glyph} />
    </div>
  );
}
