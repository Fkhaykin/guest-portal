-- Promo code table for checkout discounts
create table public.promo_code (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.property(id) on delete cascade,  -- null = global
  code text not null,
  discount_type text not null check (discount_type in ('percentage', 'flat', 'free_nights', 'free_cleaning')),
  discount_value integer not null,  -- % points, cents, or number of free nights
  min_nights integer not null default 1,
  max_uses integer,  -- null = unlimited
  times_used integer not null default 0,
  valid_from timestamptz,
  valid_until timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Case-insensitive unique index on code
create unique index idx_promo_code_code on public.promo_code (lower(code));

-- RLS
alter table public.promo_code enable row level security;

create policy "Hosts can manage promo codes"
  on public.promo_code for all
  using (is_host())
  with check (is_host());

create policy "Anyone can read active promo codes"
  on public.promo_code for select
  using (is_active = true);

-- Registration columns for checkout
alter table public.registration
  add column if not exists promo_code_id uuid references public.promo_code(id) on delete set null,
  add column if not exists discount_cents integer not null default 0,
  add column if not exists cleaning_fee_cents integer not null default 0,
  add column if not exists tax_amount_cents integer not null default 0,
  add column if not exists pet_fee_total_cents integer not null default 0,
  add column if not exists lodgify_sync_status text not null default 'pending',
  add column if not exists nightly_rates_snapshot jsonb;

-- Payment columns
alter table public.payment
  add column if not exists booking_type text not null default 'upsell';
