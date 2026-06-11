import type { CampaignTokenVars } from "@/types/database";

export function formatTokenDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function splitName(fullName: string): { first: string; last: string } {
  const trimmed = (fullName ?? "").trim();
  if (!trimmed) return { first: "", last: "" };
  const parts = trimmed.split(/\s+/);
  const first = parts[0] ?? "";
  const last = parts.length > 1 ? parts.slice(1).join(" ") : "";
  return { first, last };
}

export function interpolateTokens(template: string, vars: CampaignTokenVars): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const v = (vars as unknown as Record<string, string>)[key];
    return v !== undefined && v !== null ? String(v) : `{{${key}}}`;
  });
}

// Strip HTML to plain text fallback for SMS-channel sends when only html_body is set.
export function htmlToPlain(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
