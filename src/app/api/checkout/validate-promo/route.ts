import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchPromoByCode, buildGuestUsageByEmail } from "@/lib/promo/candidates";
import { resolvePromos, isEligible, describeResult, type BookingContext } from "@/lib/promo/resolve";
import type { PromoNight } from "@/lib/promo/free-nights";

// Validate a single typed promo code through the unified engine. Kept on the
// original response shape for back-compat; the checkout form now prefers
// /api/checkout/resolve (which also folds in automatic promos).
export async function POST(request: Request) {
  const body = await request.json();
  const {
    code,
    property_id,
    nights,
    room_rate_cents,
    cleaning_fee_cents,
    pet_fee_total_cents,
    nightly_rates,
    upsells,
    guests,
    check_in,
    check_out,
    guest_email,
  } = body as {
    code: string;
    property_id: string;
    nights: number;
    room_rate_cents: number;
    cleaning_fee_cents: number;
    pet_fee_total_cents?: number;
    nightly_rates?: PromoNight[];
    upsells?: { type: string; price_cents: number }[];
    guests?: number;
    check_in?: string;
    check_out?: string;
    guest_email?: string;
  };

  if (!code || !property_id || !nights) {
    return NextResponse.json({ valid: false, error: "Missing required fields" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const promo = await fetchPromoByCode(supabase, code);
  if (!promo) {
    return NextResponse.json({ valid: false, error: "Invalid promo code" });
  }

  const usage = await buildGuestUsageByEmail(supabase, guest_email);
  const ctx: BookingContext = {
    propertyId: property_id,
    nights,
    nightlyRates: nightly_rates ?? [],
    roomRateCents: room_rate_cents ?? 0,
    cleaningFeeCents: cleaning_fee_cents ?? 0,
    petFeeTotalCents: pet_fee_total_cents ?? 0,
    upsells: upsells ?? [],
    guests: guests ?? 1,
    checkInDate: check_in ?? "",
    checkOutDate: check_out ?? "",
    guestPriorCompletedStays: usage.priorStays,
    guestPromoUseCounts: usage.useCounts,
    now: new Date(),
  };

  const elig = isEligible(ctx, promo);
  if (!elig.ok) {
    return NextResponse.json({ valid: false, error: elig.reason ?? "Promo code not valid" });
  }

  const result = resolvePromos(ctx, [promo]);
  if (result.totalDiscountCents <= 0 && result.perks.length === 0) {
    return NextResponse.json({ valid: false, error: "This code gives no discount on this booking" });
  }

  return NextResponse.json({
    valid: true,
    promo_code_id: promo.id,
    discount_cents: result.totalDiscountCents,
    description: describeResult(result) || "Promo applied",
  });
}
