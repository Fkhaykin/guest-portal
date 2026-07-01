// Shared data-access helpers for the promo engine: fetch the candidate promos
// for a booking (auto-apply promos + an optionally typed code, scoped to the
// property) and build the per-guest history the engine needs for guest_type and
// per-guest usage caps. Used by validate-promo, resolve, create-session and the
// admin quote route so they all evaluate identically.

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizePromo, type Promo } from "@/lib/promo/types";

function norm(code?: string | null): string {
  return (code ?? "").trim().toLowerCase();
}

function promoScopeIds(p: Promo): string[] {
  if (p.property_ids && p.property_ids.length) return p.property_ids;
  if (p.property_id) return [p.property_id];
  return [];
}

// All active promos that could apply to this booking: every auto-apply promo in
// scope, plus the typed code (if any). We fetch active rows and filter in JS
// because property_ids is an array column — cheap at this table's size.
export async function fetchCandidatePromos(
  supabase: SupabaseClient,
  propertyId: string,
  code?: string | null,
): Promise<Promo[]> {
  const { data } = await supabase.from("promo_code").select("*").eq("is_active", true);
  const typed = norm(code);
  return ((data ?? []) as Record<string, unknown>[])
    .map(normalizePromo)
    .filter((p) => {
      const ids = promoScopeIds(p);
      const inScope = ids.length === 0 || ids.includes(propertyId);
      if (!inScope) return false;
      const codeMatch = typed.length > 0 && norm(p.code) === typed;
      return p.auto_apply || codeMatch;
    });
}

// Look up a single promo by typed code (case-insensitive), regardless of scope —
// used to distinguish "no such code" from "code exists but not eligible".
export async function fetchPromoByCode(
  supabase: SupabaseClient,
  code: string,
): Promise<Promo | null> {
  const { data } = await supabase
    .from("promo_code")
    .select("*")
    .ilike("code", code.trim())
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  return data ? normalizePromo(data as Record<string, unknown>) : null;
}

export type GuestUsage = { priorStays: number; useCounts: Record<string, number> };

const EMPTY_USAGE: GuestUsage = { priorStays: 0, useCounts: {} };

export async function buildGuestUsageById(
  supabase: SupabaseClient,
  guestId: string | null,
): Promise<GuestUsage> {
  if (!guestId) return EMPTY_USAGE;
  const { count } = await supabase
    .from("registration")
    .select("id", { count: "exact", head: true })
    .eq("guest_id", guestId)
    .in("status", ["active", "completed"]);

  const { data } = await supabase
    .from("registration")
    .select("applied_promo_ids, promo_code_id")
    .eq("guest_id", guestId);

  const useCounts: Record<string, number> = {};
  for (const r of (data ?? []) as {
    applied_promo_ids?: string[] | null;
    promo_code_id?: string | null;
  }[]) {
    // Prefer the stacked list; fall back to the legacy single FK for old rows.
    const ids =
      r.applied_promo_ids && r.applied_promo_ids.length
        ? r.applied_promo_ids
        : r.promo_code_id
          ? [r.promo_code_id]
          : [];
    for (const id of ids) useCounts[id] = (useCounts[id] ?? 0) + 1;
  }
  return { priorStays: count ?? 0, useCounts };
}

// Resolve guest history from an email (validate/resolve run before a guest row
// is guaranteed to exist). Returns empty usage when the guest is unknown.
export async function buildGuestUsageByEmail(
  supabase: SupabaseClient,
  email: string | null | undefined,
): Promise<GuestUsage> {
  if (!email) return EMPTY_USAGE;
  const { data: guest } = await supabase
    .from("guest")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  return buildGuestUsageById(supabase, guest?.id ?? null);
}
