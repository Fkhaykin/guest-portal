// Loads learned guidance for the draft generator from draft_feedback:
// explicit/manual notes become standing rules; recent edit pairs become
// correction examples.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DraftGuidance } from "./suggest";

const MAX_RULES = 50;
const MAX_EXAMPLES = 5;

type FeedbackRow = {
  source: "explicit" | "edit" | "manual";
  note: string | null;
  bad_draft: string | null;
  corrected_draft: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadGuidance(supabase: SupabaseClient<any, any, any>): Promise<DraftGuidance> {
  const { data } = await supabase
    .from("draft_feedback")
    .select("source, note, bad_draft, corrected_draft")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (data ?? []) as FeedbackRow[];

  const rules: string[] = [];
  const examples: { bad: string; good: string }[] = [];

  for (const row of rows) {
    if ((row.source === "explicit" || row.source === "manual") && row.note?.trim()) {
      if (rules.length < MAX_RULES && !rules.includes(row.note.trim())) {
        rules.push(row.note.trim());
      }
    } else if (row.source === "edit" && row.bad_draft && row.corrected_draft) {
      if (examples.length < MAX_EXAMPLES) {
        examples.push({ bad: row.bad_draft, good: row.corrected_draft });
      }
    }
  }

  // Oldest rules first so long-standing corrections read as foundational
  rules.reverse();
  return { rules, examples };
}
