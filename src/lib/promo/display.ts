// Presentation helpers shared by the admin Promo Builder (live preview + list)
// and the guest marketing card, so a promo reads the same everywhere.

import {
  type Offer,
  type PromoConditions,
  upsellLabel,
} from "@/lib/promo/types";

// Accent palette keys. The guest card maps these to Tailwind classes; the
// builder offers them as swatches.
export const ACCENTS = [
  "emerald",
  "indigo",
  "amber",
  "rose",
  "orange",
  "sky",
  "violet",
  "slate",
] as const;

export type Accent = (typeof ACCENTS)[number];

export function fmtDollars(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

// A short pill label for a single offer.
export function offerLabel(offer: Offer): string {
  switch (offer.kind) {
    case "percent_off":
      return `${offer.value}% off ${offer.applies_to === "room" ? "your stay" : offer.applies_to.replace("_", " ")}`;
    case "amount_off":
      return `${fmtDollars(offer.cents)} off${offer.applies_to === "total" ? "" : ` ${offer.applies_to.replace("_", " ")}`}`;
    case "free_nights": {
      const scope = offer.scope === "weeknight" ? " (weeknights)" : offer.scope === "weekend" ? " (weekends)" : "";
      return `${offer.count} free night${offer.count !== 1 ? "s" : ""}${scope}`;
    }
    case "free_cleaning":
      return "Free cleaning fee";
    case "free_pet_fee":
      return "Free pet fee";
    case "free_upsell":
      return `Free ${upsellLabel(offer.upsell_type)}`;
    case "percent_off_upsell":
      return `${offer.value}% off ${upsellLabel(offer.upsell_type)}`;
    case "perk":
      return offer.label;
  }
}

// The big highlight badge — derived from the first "headline-worthy" offer.
export function headlineFromOffers(offers: Offer[]): { big: string; sub: string } | null {
  const order: Offer["kind"][] = [
    "percent_off",
    "free_nights",
    "amount_off",
    "free_cleaning",
    "free_pet_fee",
    "percent_off_upsell",
    "free_upsell",
  ];
  const sorted = [...offers].sort(
    (a, b) => order.indexOf(a.kind) - order.indexOf(b.kind),
  );
  for (const offer of sorted) {
    switch (offer.kind) {
      case "percent_off":
        return { big: `${offer.value}%`, sub: offer.applies_to === "room" ? "off your stay" : `off ${offer.applies_to.replace("_", " ")}` };
      case "free_nights":
        return { big: offer.count === 1 ? "1 Night" : `${offer.count} Nights`, sub: "on us" };
      case "amount_off":
        return { big: fmtDollars(offer.cents), sub: "off your stay" };
      case "free_cleaning":
        return { big: "$0", sub: "cleaning fee" };
      case "free_pet_fee":
        return { big: "$0", sub: "pet fee" };
      case "percent_off_upsell":
        return { big: `${offer.value}%`, sub: `off ${upsellLabel(offer.upsell_type)}` };
      case "free_upsell":
        return { big: "Free", sub: upsellLabel(offer.upsell_type) };
    }
  }
  return null;
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function conditionPhrases(c: PromoConditions): string[] {
  const out: string[] = [];
  if (c.min_nights && c.max_nights) out.push(`${c.min_nights}–${c.max_nights} nights`);
  else if (c.min_nights && c.min_nights > 1) out.push(`${c.min_nights}+ nights`);
  else if (c.max_nights) out.push(`up to ${c.max_nights} nights`);
  if (c.min_guests && c.max_guests) out.push(`${c.min_guests}–${c.max_guests} guests`);
  else if (c.min_guests && c.min_guests > 1) out.push(`${c.min_guests}+ guests`);
  if (c.weeknights_only) out.push("weeknight stays");
  if (c.checkin_days && c.checkin_days.length && c.checkin_days.length < 7)
    out.push(`${c.checkin_days.map((d) => DOW[d]).join("/")} check-in`);
  if (c.guest_type === "first_time") out.push("first-time guests");
  if (c.guest_type === "returning") out.push("returning guests");
  if (c.min_spend_cents) out.push(`min spend ${fmtDollars(c.min_spend_cents)}`);
  if (c.stay_start_after || c.stay_start_before) out.push("select dates");
  return out;
}

// A plain-English one-liner for the builder preview / admin list.
export function summarySentence(promo: {
  offers: Offer[];
  conditions: PromoConditions;
  auto_apply: boolean;
  stackable: boolean;
  code: string | null;
}): string {
  const conds = conditionPhrases(promo.conditions);
  const offers = promo.offers.map(offerLabel);
  const condPart = conds.length ? `Stay ${conds.join(", ")} → ` : "";
  const offerPart = offers.length ? offers.join(" + ") : "no offer set";
  const tags: string[] = [];
  tags.push(promo.auto_apply ? "auto-applied" : promo.code ? `code ${promo.code}` : "no code");
  if (promo.stackable) tags.push("stackable");
  return `${condPart}${offerPart}. ${tags.join(", ")}.`;
}
