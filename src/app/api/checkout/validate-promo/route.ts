import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { freeNightsDiscountCents, type PromoNight } from "@/lib/promo/free-nights";

export async function POST(request: Request) {
  const body = await request.json();
  const { code, property_id, nights, room_rate_cents, cleaning_fee_cents, nightly_rates } = body as {
    code: string;
    property_id: string;
    nights: number;
    room_rate_cents: number;
    cleaning_fee_cents: number;
    nightly_rates?: PromoNight[];
  };

  if (!code || !property_id || !nights) {
    return NextResponse.json({ valid: false, error: "Missing required fields" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: promo } = await supabase
    .from("promo_code")
    .select("*")
    .ilike("code", code)
    .eq("is_active", true)
    .maybeSingle();

  if (!promo) {
    return NextResponse.json({ valid: false, error: "Invalid promo code" });
  }

  // Check property scope (null = global, otherwise must match)
  if (promo.property_id && promo.property_id !== property_id) {
    return NextResponse.json({ valid: false, error: "Promo code not valid for this property" });
  }

  // Check date range
  const now = new Date();
  if (promo.valid_from && new Date(promo.valid_from) > now) {
    return NextResponse.json({ valid: false, error: "Promo code is not yet active" });
  }
  if (promo.valid_until && new Date(promo.valid_until) < now) {
    return NextResponse.json({ valid: false, error: "Promo code has expired" });
  }

  // Check usage limits
  if (promo.max_uses !== null && promo.times_used >= promo.max_uses) {
    return NextResponse.json({ valid: false, error: "Promo code usage limit reached" });
  }

  // Check minimum nights
  if (nights < promo.min_nights) {
    return NextResponse.json({
      valid: false,
      error: `Minimum ${promo.min_nights} night${promo.min_nights > 1 ? "s" : ""} required for this promo`,
    });
  }

  // Calculate discount
  let discount_cents = 0;
  let description = "";

  switch (promo.discount_type) {
    case "percentage":
      discount_cents = Math.round(room_rate_cents * promo.discount_value / 100);
      description = `${promo.discount_value}% off room rate`;
      break;
    case "flat":
      discount_cents = promo.discount_value;
      description = `$${(promo.discount_value / 100).toFixed(2)} off`;
      break;
    case "free_nights": {
      const scope = promo.free_nights_scope === "weeknight" ? "weeknight" : "any";
      if (nightly_rates && nightly_rates.length > 0) {
        // Comp the cheapest eligible nights, not the average.
        discount_cents = freeNightsDiscountCents(nightly_rates, promo.discount_value, scope);
      } else {
        // Fallback when per-night pricing wasn't supplied: average them out.
        const avgNightly = Math.round(room_rate_cents / nights);
        discount_cents = avgNightly * Math.min(promo.discount_value, nights);
      }
      const freeNights = Math.min(promo.discount_value, nights);
      const scopeLabel = scope === "weeknight" ? " (weeknights)" : "";
      description = `${freeNights} free night${freeNights > 1 ? "s" : ""}${scopeLabel}`;
      break;
    }
    case "free_cleaning":
      discount_cents = cleaning_fee_cents || 0;
      description = "Free cleaning fee";
      break;
  }

  // Don't exceed room rate + cleaning
  discount_cents = Math.min(discount_cents, room_rate_cents + (cleaning_fee_cents || 0));

  return NextResponse.json({
    valid: true,
    promo_code_id: promo.id,
    discount_type: promo.discount_type,
    discount_cents,
    description,
  });
}
