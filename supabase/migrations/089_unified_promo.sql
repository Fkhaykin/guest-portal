-- Unified Promo Builder
--
-- Collapses the two decoupled promo systems into one. The `promo_code` table
-- becomes the single "promo" model: it keeps doing real checkout discounts
-- (preserving the registration.promo_code_id FK) but also absorbs the marketing
-- fields from `promotion` and gains a flexible offers/conditions engine plus
-- auto-apply + per-promo stacking.
--
-- Strategy: additive + relaxing only. Nothing is dropped here. The old
-- `promotion` table is left in place (orphaned) and removed in a later migration
-- once the new data-driven marketing card has baked in production.

-- 1. Relax the legacy columns so offer-only / auto-apply rows are valid.
--    (Multiple NULL codes are fine: the unique index on lower(code) treats NULLs
--    as distinct, so any number of auto-apply promos can have a null code.)
alter table public.promo_code alter column code drop not null;
alter table public.promo_code alter column discount_type drop not null;
alter table public.promo_code alter column discount_value drop not null;
alter table public.promo_code drop constraint if exists promo_code_discount_type_check;

-- 2. New unified columns. Everything is defaulted so existing rows stay valid.
alter table public.promo_code
  -- Marketing / presentation
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists image_url text,
  add column if not exists emoji text,
  add column if not exists accent text,                         -- color theme key
  add column if not exists terms jsonb not null default '[]'::jsonb,
  add column if not exists show_on_marketing boolean not null default false,
  add column if not exists featured boolean not null default false,
  add column if not exists sort_order integer not null default 0,
  -- Redemption
  add column if not exists auto_apply boolean not null default false,
  add column if not exists stackable boolean not null default false,
  -- Scope / limits (property_ids supersedes the single property_id column)
  add column if not exists property_ids uuid[],
  add column if not exists max_uses_per_guest integer,
  -- Engine
  add column if not exists offers jsonb not null default '[]'::jsonb,
  add column if not exists conditions jsonb not null default '{}'::jsonb,
  -- Traceability so the marketing backfill below is re-run-safe
  add column if not exists source_promotion_id uuid;

-- Non-partial unique index: source_promotion_id is NULL for all non-marketing
-- rows (multiple NULLs are allowed), and unique for backfilled marketing rows so
-- the insert below is idempotent via ON CONFLICT.
create unique index if not exists idx_promo_code_source_promotion
  on public.promo_code (source_promotion_id);

-- Fast lookup of automatic promos at checkout.
create index if not exists idx_promo_code_auto_active
  on public.promo_code (auto_apply)
  where auto_apply and is_active;

-- 3. Registration: track every applied promo so stacked promos all get their
--    usage incremented in the Stripe webhook.
alter table public.registration
  add column if not exists applied_promo_ids uuid[] not null default '{}';

-- 4. Backfill existing promo_code rows -> offers/conditions/property_ids.
--    `flat` discount_value is already in cents; everything else maps directly.
update public.promo_code set
  offers = case discount_type
      when 'percentage'    then jsonb_build_array(jsonb_build_object('kind', 'percent_off', 'value', discount_value, 'applies_to', 'room'))
      when 'flat'          then jsonb_build_array(jsonb_build_object('kind', 'amount_off', 'cents', discount_value, 'applies_to', 'total'))
      when 'free_nights'   then jsonb_build_array(jsonb_build_object('kind', 'free_nights', 'count', discount_value, 'scope', coalesce(free_nights_scope, 'any')))
      when 'free_cleaning' then jsonb_build_array(jsonb_build_object('kind', 'free_cleaning'))
    end,
  conditions = jsonb_build_object('min_nights', coalesce(min_nights, 1)),
  property_ids = case when property_id is null then null else array[property_id] end
where offers = '[]'::jsonb
  and discount_type in ('percentage', 'flat', 'free_nights', 'free_cleaning');

-- 5. Backfill `promotion` rows -> NEW marketing promo_code rows.
--    Behavior-preserving: auto_apply is always FALSE (a display-only promotion
--    must never silently start discounting bookings). The label becomes a real,
--    typeable code only when it does not collide with an existing code; on
--    collision (or when it had no label) the marketing row carries no code and
--    just renders the card. Offers are derived from the promotion's discount
--    hints — empty for pure-marketing rows, which the card renders gracefully.
with ranked as (
  select p.*,
    -- Among promotions that share a label, only the first keeps it as a real
    -- code; the rest get a null code so the unique index can't be violated.
    row_number() over (partition by lower(p.promo_code) order by p.created_at) as rn
  from public.promotion p
)
insert into public.promo_code
  (property_id, property_ids, code, title, description, image_url,
   show_on_marketing, featured, sort_order, auto_apply, stackable, is_active,
   valid_from, valid_until, offers, conditions, source_promotion_id)
select
  r.property_id,
  array[r.property_id],
  case
    when r.promo_code is null then null
    when r.rn > 1 then null  -- duplicate label among promotions
    when exists (
      select 1 from public.promo_code e
      where e.source_promotion_id is null
        and lower(e.code) = lower(r.promo_code)
    ) then null              -- collides with an existing real code
    else r.promo_code
  end,
  r.title,
  r.description,
  r.image_url,
  true,            -- show_on_marketing
  false,           -- featured
  coalesce(r.sort_order, 0),
  false,           -- auto_apply (preserve display-only behavior)
  false,           -- stackable
  r.is_active,
  r.valid_from,
  r.valid_until,
  (
    case when r.discount_percent is not null
      then jsonb_build_array(jsonb_build_object('kind', 'percent_off', 'value', r.discount_percent, 'applies_to', 'total'))
      else '[]'::jsonb end
    || case when r.discount_amount is not null
      then jsonb_build_array(jsonb_build_object('kind', 'amount_off', 'cents', r.discount_amount * 100, 'applies_to', 'total'))
      else '[]'::jsonb end
    || case when r.free_cleaning
      then jsonb_build_array(jsonb_build_object('kind', 'free_cleaning'))
      else '[]'::jsonb end
    || case when r.free_pet_fee
      then jsonb_build_array(jsonb_build_object('kind', 'free_pet_fee'))
      else '[]'::jsonb end
  ),
  '{}'::jsonb,
  r.id
from ranked r
on conflict (source_promotion_id) do nothing;
