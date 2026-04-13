-- Fixup: apply parts of 043 that may have been missed due to trigger error

-- RLS (idempotent)
alter table if exists public.promo_code enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'promo_code' and policyname = 'Hosts can manage promo codes') then
    create policy "Hosts can manage promo codes" on public.promo_code for all using (is_host()) with check (is_host());
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'promo_code' and policyname = 'Anyone can read active promo codes') then
    create policy "Anyone can read active promo codes" on public.promo_code for select using (is_active = true);
  end if;
end $$;

-- Registration columns (idempotent via if not exists)
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
