import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  diffStats,
  summarizeOutcomes,
  OUTCOME_HOUSES,
  type OutcomeRow,
} from "@/lib/guest-messages/outcome";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Keep only a recognised house key; anything else (or missing) → null so we
 * never trip the draft_outcome house check constraint. */
function normalizeHouse(house: unknown): string | null {
  return typeof house === "string" && (OUTCOME_HOUSES as readonly string[]).includes(house)
    ? house
    : null;
}

// POST /api/admin/messages/outcome
// Records what the host did with an AI-generated draft. Best-effort telemetry —
// the messenger fires it and ignores the response.
// Body: {
//   bookingId?: number | string,   // Lodgify id, registration UUID, or web uid
//   house?: string | null,
//   guestMessageHash?: string | null,
//   draft: string,                 // the AI draft text (required)
//   sent?: string | null,          // final sent text; omit/null when discarded
//   discarded?: boolean,           // true when cleared without sending
// }
export async function POST(request: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    bookingId?: number | string;
    house?: string | null;
    guestMessageHash?: string | null;
    draft?: string;
    sent?: string | null;
    discarded?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.draft?.trim()) {
    return NextResponse.json({ error: "draft required" }, { status: 400 });
  }

  // Numeric Lodgify id when it looks like one; the raw ref always kept.
  const rawId = body.bookingId;
  const lodgifyBookingId =
    typeof rawId === "number"
      ? rawId
      : typeof rawId === "string" && /^\d+$/.test(rawId)
        ? Number(rawId)
        : null;
  const bookingRef = rawId != null ? String(rawId) : null;
  const house = normalizeHouse(body.house);
  const guestMessageHash = body.guestMessageHash?.slice(0, 64) ?? null;

  const isDiscard = body.discarded === true || !body.sent?.trim();

  const record: Record<string, unknown> = {
    lodgify_booking_id: lodgifyBookingId,
    booking_ref: bookingRef,
    house,
    guest_message_hash: guestMessageHash,
  };

  if (isDiscard) {
    record.outcome = "discarded";
    record.draft_length = body.draft.trim().length;
  } else {
    const stats = diffStats(body.draft, body.sent as string);
    record.outcome = stats.outcome; // "accepted" | "edited"
    record.draft_length = stats.draftLength;
    record.sent_length = stats.sentLength;
    record.distance = stats.distance;
    record.percent_changed = stats.percentChanged;
  }

  const admin = createAdminClient();
  const { error } = await admin.from("draft_outcome").insert(record);
  if (error) {
    console.error("[outcome] insert failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, outcome: record.outcome });
}

// GET /api/admin/messages/outcome?days=30
// Aggregated acceptance stats over the trailing window (default 30 days).
export async function GET(request: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const daysParam = Number(request.nextUrl.searchParams.get("days"));
  const days = Number.isFinite(daysParam) ? Math.min(Math.max(Math.trunc(daysParam), 1), 365) : 30;
  const fromIso = new Date(Date.now() - days * 86_400_000).toISOString();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("draft_outcome")
    .select("outcome, percent_changed, house, created_at")
    .gte("created_at", fromIso)
    .order("created_at", { ascending: true })
    .limit(5000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const summary = summarizeOutcomes((data ?? []) as OutcomeRow[]);
  return NextResponse.json({ days, summary });
}
