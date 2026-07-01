// Unified Promo model — the shared shape behind the Promo Builder, the checkout
// resolution engine, and the guest marketing card. The Supabase clients in this
// project are untyped, so this is the source of truth for a `promo_code` row's
// unified shape (DB columns are loose `any` at the client boundary; we cast to
// these types where we read them).

// ---------------------------------------------------------------------------
// Offers — what a guest actually gets. A single promo can stack any number of
// these (e.g. 10% off room + free cleaning + free firewood + a display perk).
// ---------------------------------------------------------------------------

export type DiscountTarget = "room" | "total" | "cleaning" | "pet_fee";

export type PercentOffOffer = {
  kind: "percent_off";
  value: number; // 0–100
  applies_to: DiscountTarget;
};

export type AmountOffOffer = {
  kind: "amount_off";
  cents: number;
  applies_to: DiscountTarget;
};

export type FreeNightsOffer = {
  kind: "free_nights";
  count: number;
  scope: "any" | "weeknight" | "weekend";
};

export type FreeCleaningOffer = { kind: "free_cleaning" };
export type FreePetFeeOffer = { kind: "free_pet_fee" };

export type FreeUpsellOffer = {
  kind: "free_upsell";
  upsell_type: string; // comps the line item if the guest bought it
};

export type PercentOffUpsellOffer = {
  kind: "percent_off_upsell";
  upsell_type: string;
  value: number; // 0–100
};

// Display-only — shows on the marketing card, never touches checkout math.
export type PerkOffer = {
  kind: "perk";
  label: string;
};

export type Offer =
  | PercentOffOffer
  | AmountOffOffer
  | FreeNightsOffer
  | FreeCleaningOffer
  | FreePetFeeOffer
  | FreeUpsellOffer
  | PercentOffUpsellOffer
  | PerkOffer;

export type OfferKind = Offer["kind"];

// Offers that produce a real discount at checkout (everything except `perk`).
export const MONETARY_OFFER_KINDS: OfferKind[] = [
  "percent_off",
  "amount_off",
  "free_nights",
  "free_cleaning",
  "free_pet_fee",
  "free_upsell",
  "percent_off_upsell",
];

// ---------------------------------------------------------------------------
// Conditions — every gate is optional; a promo applies only when ALL of its set
// conditions pass (logical AND).
// ---------------------------------------------------------------------------

export type GuestType = "any" | "first_time" | "returning";

export type PromoConditions = {
  min_nights?: number;
  max_nights?: number;
  min_guests?: number;
  max_guests?: number;
  // Stay (check-in) must fall within this window. ISO date strings (YYYY-MM-DD).
  stay_start_after?: string;
  stay_start_before?: string;
  // Allowed check-in weekdays, 0=Sun … 6=Sat. Empty/absent = any day.
  checkin_days?: number[];
  // Every night of the stay must be a weeknight (Sun–Thu).
  weeknights_only?: boolean;
  guest_type?: GuestType;
  // Minimum pre-tax subtotal (room + cleaning + pet + upsells), in cents.
  min_spend_cents?: number;
};

// ---------------------------------------------------------------------------
// The unified promo row (a `promo_code` table row, post-089 migration).
// ---------------------------------------------------------------------------

export type Promo = {
  id: string;
  // Scope. property_ids supersedes the legacy single property_id. Null/empty = global.
  property_id: string | null;
  property_ids: string[] | null;
  // Redemption
  code: string | null;
  auto_apply: boolean;
  stackable: boolean;
  // Engine
  offers: Offer[];
  conditions: PromoConditions;
  // Limits / window
  valid_from: string | null;
  valid_until: string | null;
  max_uses: number | null;
  max_uses_per_guest: number | null;
  times_used: number;
  is_active: boolean;
  // Marketing / presentation
  title: string | null;
  description: string | null;
  image_url: string | null;
  emoji: string | null;
  accent: string | null;
  terms: string[];
  show_on_marketing: boolean;
  featured: boolean;
  sort_order: number;
  created_at?: string;
  source_promotion_id?: string | null;
};

// Coerce a raw DB row (untyped client → `any`) into a Promo with sane defaults.
export function normalizePromo(row: Record<string, unknown>): Promo {
  return {
    id: String(row.id),
    property_id: (row.property_id as string) ?? null,
    property_ids: (row.property_ids as string[] | null) ?? null,
    code: (row.code as string | null) ?? null,
    auto_apply: Boolean(row.auto_apply),
    stackable: Boolean(row.stackable),
    offers: Array.isArray(row.offers) ? (row.offers as Offer[]) : [],
    conditions: (row.conditions as PromoConditions) ?? {},
    valid_from: (row.valid_from as string | null) ?? null,
    valid_until: (row.valid_until as string | null) ?? null,
    max_uses: (row.max_uses as number | null) ?? null,
    max_uses_per_guest: (row.max_uses_per_guest as number | null) ?? null,
    times_used: (row.times_used as number) ?? 0,
    is_active: row.is_active !== false,
    title: (row.title as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    image_url: (row.image_url as string | null) ?? null,
    emoji: (row.emoji as string | null) ?? null,
    accent: (row.accent as string | null) ?? null,
    terms: Array.isArray(row.terms) ? (row.terms as string[]) : [],
    show_on_marketing: Boolean(row.show_on_marketing),
    featured: Boolean(row.featured),
    sort_order: (row.sort_order as number) ?? 0,
    created_at: (row.created_at as string) ?? undefined,
    source_promotion_id: (row.source_promotion_id as string | null) ?? null,
  };
}

// ---------------------------------------------------------------------------
// Upsell catalog — the selectable add-on types for free_upsell / percent_off_upsell
// offers. Mirrors the upsell definitions in the checkout + guest upsell routes.
// ---------------------------------------------------------------------------

export const UPSELL_OPTIONS: { type: string; label: string }[] = [
  { type: "early_checkin", label: "Early Check-In" },
  { type: "late_checkout", label: "Late Check-Out" },
  { type: "new_sheets", label: "Brand New Sheets" },
  { type: "firewood", label: "Firewood Delivery" },
  { type: "baby_high_chair", label: "Baby High Chair" },
  { type: "breakfast_delivery", label: "Breakfast Delivery" },
  { type: "private_chef", label: "Private Chef" },
  { type: "luxury_picnic", label: "Luxury Picnic" },
];

export function upsellLabel(type: string): string {
  return UPSELL_OPTIONS.find((u) => u.type === type)?.label ?? type;
}
