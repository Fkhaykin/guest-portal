-- Separate guest-facing pricing from cleaner payout amounts
alter table public.property
  add column if not exists guest_cleaning_fee_cents integer not null default 27500,
  add column if not exists guest_pet_fee_cents integer not null default 10000;
