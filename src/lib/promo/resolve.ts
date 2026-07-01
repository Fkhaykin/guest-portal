// Promo resolution engine — the single source of truth for "given a booking and
// a set of candidate promos, what discount does the guest get?". Pure and
// framework-free so it can run in any API route (validate, resolve, checkout,
// admin quote) and be unit-tested in isolation.
//
// Key correctness rule: all offers — within one promo AND across stacked promos —
// draw from a shared per-component "remaining base" ledger, so two percent-off
// offers can never discount the same dollar twice.

import { freeNightsDiscountCents, isWeeknight } from "@/lib/promo/free-nights";
import {
  type Offer,
  type OfferKind,
  type Promo,
  upsellLabel,
} from "@/lib/promo/types";

export type BookingContext = {
  propertyId: string;
  nights: number;
  nightlyRates: { date: string; price_cents: number }[];
  roomRateCents: number;
  cleaningFeeCents: number;
  petFeeTotalCents: number;
  upsells: { type: string; price_cents: number }[];
  guests: number;
  checkInDate: string; // YYYY-MM-DD
  checkOutDate: string; // YYYY-MM-DD
  guestPriorCompletedStays: number;
  guestPromoUseCounts: Record<string, number>;
  now: Date;
};

export type BreakdownLine = {
  promoId: string;
  code: string | null;
  kind: OfferKind;
  label: string;
  discountCents: number;
  target: "room" | "cleaning" | "pet_fee" | "upsell";
  upsellType?: string;
};

export type ResolveResult = {
  appliedPromoIds: string[];
  primaryPromoId: string | null;
  couponDiscountCents: number; // room + cleaning + pet → single Stripe coupon
  upsellAdjustments: Record<string, number>; // upsell_type → cents off that line item
  totalDiscountCents: number;
  breakdown: BreakdownLine[];
  perks: string[];
};

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------

export type EligibilityResult = { ok: boolean; reason?: string };

// valid_until without a time component (a plain date) is treated as inclusive
// through the end of that day, so "valid until Jun 30" works all of Jun 30.
function endOfWindow(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(value + "T23:59:59.999");
  return new Date(value);
}

function promoPropertyIds(promo: Promo): string[] {
  if (promo.property_ids && promo.property_ids.length) return promo.property_ids;
  if (promo.property_id) return [promo.property_id];
  return []; // global
}

export function isEligible(ctx: BookingContext, promo: Promo): EligibilityResult {
  if (!promo.is_active) return { ok: false, reason: "This promo is no longer active" };

  if (promo.valid_from && new Date(promo.valid_from) > ctx.now)
    return { ok: false, reason: "This promo isn't active yet" };
  if (promo.valid_until && endOfWindow(promo.valid_until) < ctx.now)
    return { ok: false, reason: "This promo has expired" };

  if (promo.max_uses != null && promo.times_used >= promo.max_uses)
    return { ok: false, reason: "This promo has reached its usage limit" };
  if (
    promo.max_uses_per_guest != null &&
    (ctx.guestPromoUseCounts[promo.id] ?? 0) >= promo.max_uses_per_guest
  )
    return { ok: false, reason: "You've already used this promo" };

  const ids = promoPropertyIds(promo);
  if (ids.length && !ids.includes(ctx.propertyId))
    return { ok: false, reason: "Not valid for this property" };

  const c = promo.conditions || {};
  if (c.min_nights != null && ctx.nights < c.min_nights)
    return { ok: false, reason: `Minimum ${c.min_nights} night${c.min_nights !== 1 ? "s" : ""} required` };
  if (c.max_nights != null && ctx.nights > c.max_nights)
    return { ok: false, reason: `Maximum ${c.max_nights} nights` };
  if (c.min_guests != null && ctx.guests < c.min_guests)
    return { ok: false, reason: `Minimum ${c.min_guests} guests required` };
  if (c.max_guests != null && ctx.guests > c.max_guests)
    return { ok: false, reason: `Maximum ${c.max_guests} guests` };
  if (c.stay_start_after && ctx.checkInDate < c.stay_start_after)
    return { ok: false, reason: "Stay dates not eligible" };
  if (c.stay_start_before && ctx.checkInDate > c.stay_start_before)
    return { ok: false, reason: "Stay dates not eligible" };
  if (c.checkin_days && c.checkin_days.length) {
    const dow = new Date(ctx.checkInDate + "T00:00:00").getDay();
    if (!c.checkin_days.includes(dow))
      return { ok: false, reason: "Not valid for this check-in day" };
  }
  if (c.weeknights_only && !ctx.nightlyRates.every((n) => isWeeknight(n.date)))
    return { ok: false, reason: "Weeknight stays only (Sun–Thu)" };
  if (c.guest_type === "first_time" && ctx.guestPriorCompletedStays > 0)
    return { ok: false, reason: "First-time guests only" };
  if (c.guest_type === "returning" && ctx.guestPriorCompletedStays < 1)
    return { ok: false, reason: "Returning guests only" };
  if (c.min_spend_cents != null) {
    const subtotal =
      ctx.roomRateCents +
      ctx.cleaningFeeCents +
      ctx.petFeeTotalCents +
      ctx.upsells.reduce((s, u) => s + u.price_cents, 0);
    if (subtotal < c.min_spend_cents)
      return { ok: false, reason: `Minimum spend of $${Math.round(c.min_spend_cents / 100)} required` };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Ledger + per-promo application
// ---------------------------------------------------------------------------

type Ledger = {
  room: number;
  cleaning: number;
  pet: number;
  upsell: Record<string, number>;
};

function newLedger(ctx: BookingContext): Ledger {
  const upsell: Record<string, number> = {};
  for (const u of ctx.upsells) upsell[u.type] = (upsell[u.type] ?? 0) + u.price_cents;
  return {
    room: ctx.roomRateCents,
    cleaning: ctx.cleaningFeeCents,
    pet: ctx.petFeeTotalCents,
    upsell,
  };
}

// Fixed application order so the result is deterministic regardless of how the
// host arranged the offers. Comps first, then fixed/percent discounts.
const OFFER_ORDER: OfferKind[] = [
  "free_nights",
  "free_cleaning",
  "free_pet_fee",
  "free_upsell",
  "amount_off",
  "percent_off",
  "percent_off_upsell",
  "perk",
];

// Draw `amount` from room → cleaning → pet, returning how much was actually drawn.
function drawCombined(ledger: Ledger, amount: number): number {
  let drawn = 0;
  for (const slot of ["room", "cleaning", "pet"] as const) {
    if (drawn >= amount) break;
    const take = Math.min(ledger[slot], amount - drawn);
    ledger[slot] -= take;
    drawn += take;
  }
  return drawn;
}

type PromoApplication = {
  couponCents: number;
  upsellAdj: Record<string, number>;
  perks: string[];
  lines: BreakdownLine[];
};

function applyPromo(ctx: BookingContext, promo: Promo, ledger: Ledger): PromoApplication {
  const offers = [...(promo.offers || [])].sort(
    (a, b) => OFFER_ORDER.indexOf(a.kind) - OFFER_ORDER.indexOf(b.kind),
  );
  let couponCents = 0;
  const upsellAdj: Record<string, number> = {};
  const perks: string[] = [];
  const lines: BreakdownLine[] = [];

  const pushLine = (
    kind: OfferKind,
    label: string,
    discountCents: number,
    target: BreakdownLine["target"],
    upsellType?: string,
  ) => {
    if (discountCents <= 0) return;
    lines.push({ promoId: promo.id, code: promo.code, kind, label, discountCents, target, upsellType });
  };

  for (const offer of offers) {
    applyOffer(offer);
  }

  function applyOffer(offer: Offer) {
    switch (offer.kind) {
      case "free_nights": {
        const raw = freeNightsDiscountCents(ctx.nightlyRates, offer.count, offer.scope);
        const d = Math.min(raw, ledger.room);
        ledger.room -= d;
        couponCents += d;
        const scopeLabel = offer.scope === "weeknight" ? " (weeknights)" : offer.scope === "weekend" ? " (weekends)" : "";
        pushLine("free_nights", `${offer.count} free night${offer.count !== 1 ? "s" : ""}${scopeLabel}`, d, "room");
        break;
      }
      case "free_cleaning": {
        const d = ledger.cleaning;
        ledger.cleaning -= d;
        couponCents += d;
        pushLine("free_cleaning", "Free cleaning fee", d, "cleaning");
        break;
      }
      case "free_pet_fee": {
        const d = ledger.pet;
        ledger.pet -= d;
        couponCents += d;
        pushLine("free_pet_fee", "Free pet fee", d, "pet_fee");
        break;
      }
      case "free_upsell": {
        const d = ledger.upsell[offer.upsell_type] ?? 0;
        ledger.upsell[offer.upsell_type] = 0;
        upsellAdj[offer.upsell_type] = (upsellAdj[offer.upsell_type] ?? 0) + d;
        pushLine("free_upsell", `Free ${upsellLabel(offer.upsell_type)}`, d, "upsell", offer.upsell_type);
        break;
      }
      case "amount_off": {
        if (offer.applies_to === "total") {
          const d = drawCombined(ledger, offer.cents);
          couponCents += d;
          pushLine("amount_off", `$${(offer.cents / 100).toFixed(0)} off`, d, "room");
        } else {
          const slot = offer.applies_to === "cleaning" ? "cleaning" : offer.applies_to === "pet_fee" ? "pet" : "room";
          const d = Math.min(offer.cents, ledger[slot]);
          ledger[slot] -= d;
          couponCents += d;
          const target = slot === "pet" ? "pet_fee" : slot;
          pushLine("amount_off", `$${(offer.cents / 100).toFixed(0)} off ${slot === "room" ? "room" : target.replace("_", " ")}`, d, target);
        }
        break;
      }
      case "percent_off": {
        if (offer.applies_to === "total") {
          const base = ledger.room + ledger.cleaning + ledger.pet;
          const d = drawCombined(ledger, Math.round((base * offer.value) / 100));
          couponCents += d;
          pushLine("percent_off", `${offer.value}% off`, d, "room");
        } else {
          const slot = offer.applies_to === "cleaning" ? "cleaning" : offer.applies_to === "pet_fee" ? "pet" : "room";
          const d = Math.round((ledger[slot] * offer.value) / 100);
          ledger[slot] -= d;
          couponCents += d;
          const target = slot === "pet" ? "pet_fee" : slot;
          pushLine("percent_off", `${offer.value}% off ${slot === "room" ? "room" : target.replace("_", " ")}`, d, target);
        }
        break;
      }
      case "percent_off_upsell": {
        const base = ledger.upsell[offer.upsell_type] ?? 0;
        const d = Math.round((base * offer.value) / 100);
        ledger.upsell[offer.upsell_type] = base - d;
        upsellAdj[offer.upsell_type] = (upsellAdj[offer.upsell_type] ?? 0) + d;
        pushLine("percent_off_upsell", `${offer.value}% off ${upsellLabel(offer.upsell_type)}`, d, "upsell", offer.upsell_type);
        break;
      }
      case "perk": {
        if (offer.label) perks.push(offer.label);
        break;
      }
    }
  }

  return { couponCents, upsellAdj, perks, lines };
}

function appValue(app: PromoApplication): number {
  return app.couponCents + Object.values(app.upsellAdj).reduce((s, v) => s + v, 0);
}

function mergeUpsell(into: Record<string, number>, from: Record<string, number>) {
  for (const [k, v] of Object.entries(from)) into[k] = (into[k] ?? 0) + v;
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

export function resolvePromos(ctx: BookingContext, candidates: Promo[]): ResolveResult {
  const empty: ResolveResult = {
    appliedPromoIds: [],
    primaryPromoId: null,
    couponDiscountCents: 0,
    upsellAdjustments: {},
    totalDiscountCents: 0,
    breakdown: [],
    perks: [],
  };

  const eligible = candidates.filter((p) => isEligible(ctx, p).ok);
  if (eligible.length === 0) return empty;

  const stackable = eligible.filter((p) => p.stackable);
  const exclusive = eligible.filter((p) => !p.stackable);

  // Stacked candidate: all stackable promos share one ledger.
  const stackedLedger = newLedger(ctx);
  let stackedCoupon = 0;
  const stackedUpsell: Record<string, number> = {};
  const stackedLines: BreakdownLine[] = [];
  const stackedPerks: string[] = [];
  const stackedContrib: { id: string; value: number }[] = [];
  for (const promo of stackable) {
    const app = applyPromo(ctx, promo, stackedLedger);
    const v = appValue(app);
    stackedCoupon += app.couponCents;
    mergeUpsell(stackedUpsell, app.upsellAdj);
    stackedLines.push(...app.lines);
    if (v > 0) {
      stackedPerks.push(...app.perks);
      stackedContrib.push({ id: promo.id, value: v });
    }
  }
  const stackedValue = stackedCoupon + Object.values(stackedUpsell).reduce((s, v) => s + v, 0);

  // Best single exclusive promo (each evaluated against a fresh ledger).
  let bestExclusive: { promo: Promo; app: PromoApplication; value: number } | null = null;
  for (const promo of exclusive) {
    const app = applyPromo(ctx, promo, newLedger(ctx));
    const v = appValue(app);
    if (v > 0 && (!bestExclusive || v > bestExclusive.value)) {
      bestExclusive = { promo, app, value: v };
    }
  }

  // Winner: best value between the stacked set and the best single exclusive.
  const useExclusive = bestExclusive != null && bestExclusive.value > stackedValue;

  let couponCents: number;
  let upsellAdj: Record<string, number>;
  let lines: BreakdownLine[];
  let perks: string[];
  let appliedIds: string[];
  let primaryPromoId: string | null;

  if (useExclusive && bestExclusive) {
    couponCents = bestExclusive.app.couponCents;
    upsellAdj = bestExclusive.app.upsellAdj;
    lines = bestExclusive.app.lines;
    perks = bestExclusive.app.perks;
    appliedIds = [bestExclusive.promo.id];
    primaryPromoId = bestExclusive.promo.id;
  } else if (stackedValue > 0) {
    couponCents = stackedCoupon;
    upsellAdj = stackedUpsell;
    lines = stackedLines;
    perks = stackedPerks;
    appliedIds = stackedContrib.map((c) => c.id);
    primaryPromoId =
      stackedContrib.slice().sort((a, b) => b.value - a.value)[0]?.id ?? null;
  } else {
    return empty;
  }

  // Defensive cap: coupon never exceeds the room+cleaning+pet base.
  const couponBase = ctx.roomRateCents + ctx.cleaningFeeCents + ctx.petFeeTotalCents;
  couponCents = Math.min(couponCents, couponBase);
  const upsellTotal = Object.values(upsellAdj).reduce((s, v) => s + v, 0);

  return {
    appliedPromoIds: appliedIds,
    primaryPromoId,
    couponDiscountCents: couponCents,
    upsellAdjustments: upsellAdj,
    totalDiscountCents: couponCents + upsellTotal,
    breakdown: lines,
    perks,
  };
}

// One-line human summary of a resolution (for validate/resolve responses).
export function describeResult(result: ResolveResult): string {
  const parts = result.breakdown.map((l) => l.label);
  if (result.perks.length) parts.push(...result.perks);
  return parts.join(" + ");
}
