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

// `house` scopes which rules load: global rules (house IS NULL) always apply;
// house-scoped rules only load for that home, so one home's correction never
// leaks into another's drafts. Pass null/undefined to load global rules only.
export async function loadGuidance(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  house?: string | null
): Promise<DraftGuidance> {
  let query = supabase
    .from("draft_feedback")
    .select("source, note, bad_draft, corrected_draft")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(200);

  // house is a controlled enum (lakehouse/chalet/…), safe to interpolate.
  query = house ? query.or(`house.is.null,house.eq.${house}`) : query.is("house", null);

  const { data } = await query;

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
