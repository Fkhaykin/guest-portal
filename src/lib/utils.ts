import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/**
 * tailwind-merge has to be told about our own `text-*` size utilities
 * (globals.css: text-display / text-title-lg / text-title / text-eyebrow).
 * Without this it reads `text-eyebrow` as a *color* and silently drops it the
 * moment a call site also passes `text-muted-foreground` — which is exactly
 * how every eyebrow is written.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["display", "title-lg", "title", "eyebrow"] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
