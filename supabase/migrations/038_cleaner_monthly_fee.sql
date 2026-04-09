-- Add monthly fee field to cleaner table
alter table public.cleaner
  add column monthly_fee_cents integer not null default 0;
