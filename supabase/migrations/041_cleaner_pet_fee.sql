-- Add per-cleaner pet fee (what the cleaner gets paid per pet cleaning)
-- Guest-facing pet fee remains on the property table ($100 default)
alter table public.cleaner
  add column pet_fee_cents integer not null default 0;
