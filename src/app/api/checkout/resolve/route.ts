import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchCandidatePromos,
  fetchPromoByCode,
  buildGuestUsageByEmail,
} from "@/lib/promo/candidates";
import { resolvePromos, isEligible, type BookingContext } from "@/lib/promo/resolve";

// The unified checkout promo resolver. Given the booking context (and an
// optional typed code + guest email), it runs the full engine over every
// applicable promo — automatic ones plus the typed code — against a shared
// ledger and returns the combined discount. This is the number the checkout
// form displays; create-session recomputes it authoritatively server-side.

type Body = {
  property_id: string;
  check_in: string;
  check_out: string;
  guests: number;
  pets?: number;
  room_rate_cents: number;
  cleaning_fee_cents: number;
  pet_fee_total_cents?: number;
  nightly_rates?: { date: string; price_cents: number }[];
  upsells?: { type: string; price_cents: number }[];
  code?: string;
  guest_email?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as Body;
  const { property_id, check_in, check_out, code } = body;

  if (!property_id || !check_in || !check_out) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const nights = Math.round(
    (new Date(check_out + "T00:00:00").getTime() - new Date(check_in + "T00:00:00").getTime()) /
      (1000 * 60 * 60 * 24),
  );

  const [candidates, usage] = await Promise.all([
    fetchCandidatePromos(supabase, property_id, code),
    buildGuestUsageByEmail(supabase, body.guest_email),
  ]);

  const ctx: BookingContext = {
    propertyId: property_id,
    nights,
    nightlyRates: body.nightly_rates ?? [],
    roomRateCents: body.room_rate_cents ?? 0,
    cleaningFeeCents: body.cleaning_fee_cents ?? 0,
    petFeeTotalCents: body.pet_fee_total_cents ?? 0,
    upsells: body.upsells ?? [],
    guests: body.guests ?? 1,
    checkInDate: check_in,
    checkOutDate: check_out,
    guestPriorCompletedStays: usage.priorStays,
    guestPromoUseCounts: usage.useCounts,
    now: new Date(),
  };

  const result = resolvePromos(ctx, candidates);

  // Report on the typed code specifically, so the form can show "applied" /
  // "expired" / "invalid" distinctly.
  let codeInfo: { provided: boolean; valid: boolean; applied: boolean; error?: string } = {
    provided: false,
    valid: false,
    applied: false,
  };
  if (code && code.trim()) {
    const typed = candidates.find((p) => (p.code ?? "").trim().toLowerCase() === code.trim().toLowerCase());
    if (!typed) {
      // Exists at all, or genuinely unknown?
      const anyMatch = await fetchPromoByCode(supabase, code);
      codeInfo = {
        provided: true,
        valid: false,
        applied: false,
        error: anyMatch ? "Promo code not valid for this property" : "Invalid promo code",
      };
    } else {
      const elig = isEligible(ctx, typed);
      codeInfo = {
        provided: true,
        valid: elig.ok,
        applied: result.appliedPromoIds.includes(typed.id),
        error: elig.ok ? undefined : elig.reason,
      };
    }
  }

  return NextResponse.json({
    coupon_discount_cents: result.couponDiscountCents,
    upsell_adjustments: result.upsellAdjustments,
    total_discount_cents: result.totalDiscountCents,
    breakdown: result.breakdown.map((l) => ({
      label: l.label,
      discount_cents: l.discountCents,
      upsell_type: l.upsellType ?? null,
    })),
    perks: result.perks,
    applied_promo_ids: result.appliedPromoIds,
    primary_promo_id: result.primaryPromoId,
    code: codeInfo,
  });
}
