import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createAdminClient } from "@/lib/supabase/admin";
import { SECTIONS } from "@/lib/policy-content";
import { QUICK_RULES } from "@/lib/house-rules";
import { COMMUNITIES } from "@/lib/things-to-do-content";
import { FAQ_CATEGORIES } from "@/lib/faq-content";
import { SITE_URL } from "@/lib/seo";

// Expanded machine-readable site summary for AI agents, generated from the
// same source files that render the human pages so it can't drift. Pricing is
// deliberately absent — it's dynamic; agents should call the pricing API.
export const revalidate = 3600;

export async function GET() {
  const supabase = createAdminClient();
  const { data: properties } = await supabase
    .from("property")
    .select("name, slug, address, description, max_guests")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const stripHtml = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  const lines: string[] = [];
  const header = await readFile(join(process.cwd(), "public", "llms.txt"), "utf8");
  lines.push(header.trim(), "");

  lines.push("---", "", "# Expanded detail", "");

  lines.push("## Property detail", "");
  for (const p of properties ?? []) {
    lines.push(`### ${p.name}`);
    lines.push(`- URL: ${SITE_URL}/book/${p.slug}`);
    if (p.address) lines.push(`- Address area: ${p.address}`);
    if (p.max_guests) lines.push(`- Max occupancy: ${p.max_guests} (hard cap, includes children)`);
    if (p.description) lines.push(`- Description: ${stripHtml(p.description).slice(0, 600)}`);
    lines.push("");
  }

  lines.push("## Quick house rules", "");
  for (const r of QUICK_RULES) {
    lines.push(`- ${r.rule} — ${r.detail}`);
  }
  lines.push("");

  lines.push("## Communities", "");
  for (const c of COMMUNITIES) {
    lines.push(`### ${c.name}`, c.description, "");
    for (const g of c.groups) {
      for (const item of g.items) {
        lines.push(`- ${item.name}: ${item.description}`);
      }
    }
    lines.push("");
  }

  lines.push("## Guest FAQ", "");
  for (const cat of FAQ_CATEGORIES) {
    lines.push(`### ${cat.title}`, "");
    for (const item of cat.items) {
      lines.push(`Q: ${item.q}`, `A: ${item.a}`, "");
    }
  }

  lines.push("## Full rental policies", "");
  for (const s of SECTIONS) {
    lines.push(`### ${s.number}. ${s.title}`);
    for (const p of s.paragraphs ?? []) lines.push(p);
    for (const item of s.items ?? []) {
      lines.push(item.label ? `- ${item.label}: ${item.body}` : `- ${item.body}`);
    }
    lines.push("");
  }

  lines.push(
    "---",
    "",
    "Pricing is dynamic. For a quote, call the pricing API documented above,",
    `or open ${SITE_URL}/search to check availability interactively.`
  );

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
