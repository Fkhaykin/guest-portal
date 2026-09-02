/**
 * Single source of truth for status colors across admin / cleaner / guest.
 *
 * Before this, ~6 files each hardcoded their own `bg-blue-100 text-blue-800`
 * style maps with no shared rationale (blue, green, amber, orange, rose, teal
 * all used interchangeably). Everything now resolves to a small set of semantic
 * tones backed by design tokens (see globals.css), so status color reads
 * intentional instead of like raw Tailwind hues.
 */

export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

/** Soft badge/pill: tinted background + colored text. */
export function toneBadge(tone: Tone): string {
  switch (tone) {
    case "info":
      return "bg-primary/10 text-primary";
    case "success":
      return "bg-success/10 text-success";
    case "warning":
      return "bg-warning/15 text-warning";
    case "danger":
      return "bg-destructive/10 text-destructive";
    default:
      return "bg-muted text-muted-foreground";
  }
}

/** Solid badge: filled background + on-color text (for high-emphasis chips). */
export function toneSolid(tone: Tone): string {
  switch (tone) {
    case "info":
      return "bg-primary text-primary-foreground";
    case "success":
      return "bg-success text-success-foreground";
    case "warning":
      return "bg-warning text-warning-foreground";
    case "danger":
      return "bg-destructive text-white";
    default:
      return "bg-muted text-muted-foreground";
  }
}

/** Icon tile used on stat cards — tinted square holding a lucide icon. */
export function toneTile(tone: Tone): string {
  switch (tone) {
    case "info":
      return "bg-primary/10 text-primary";
    case "success":
      return "bg-success/10 text-success";
    case "warning":
      return "bg-warning/15 text-warning";
    case "danger":
      return "bg-destructive/10 text-destructive";
    default:
      return "bg-muted text-muted-foreground";
  }
}

/**
 * Decorative accent ramp. Tones carry *meaning* (this thing succeeded, this
 * one is overdue); accents carry *identity* — the five slots that let a row
 * of icon tiles or category cards look varied without reaching for raw
 * Tailwind hues. Never use an accent to signal status.
 */
export type Accent = "lake" | "pine" | "sand" | "dusk" | "ember";

/** Tinted square holding an icon, in one of the five decorative accents. */
export function accentTile(accent: Accent): string {
  switch (accent) {
    case "pine":
      return "bg-tint-pine/12 text-tint-pine";
    case "sand":
      return "bg-tint-sand/15 text-tint-sand";
    case "dusk":
      return "bg-tint-dusk/12 text-tint-dusk";
    case "ember":
      return "bg-tint-ember/12 text-tint-ember";
    default:
      return "bg-tint-lake/12 text-tint-lake";
  }
}

/** Bare accent-colored text (icons, small labels, category dots). */
export function accentText(accent: Accent): string {
  switch (accent) {
    case "pine":
      return "text-tint-pine";
    case "sand":
      return "text-tint-sand";
    case "dusk":
      return "text-tint-dusk";
    case "ember":
      return "text-tint-ember";
    default:
      return "text-tint-lake";
  }
}

/** Map common status strings (reservation + invoice) to a tone. */
export function statusTone(status: string): Tone {
  switch (status.toLowerCase()) {
    case "active":
    case "current":
    case "paid":
    case "approved":
    case "completed":
    case "confirmed":
      return "success";
    case "upcoming":
    case "future":
    case "submitted":
    case "pending":
    case "in_progress":
      return "info";
    case "open":
    case "draft":
    case "past":
      return "warning";
    case "cancelled":
    case "canceled":
    case "declined":
    case "overdue":
      return "danger";
    default:
      return "neutral";
  }
}
