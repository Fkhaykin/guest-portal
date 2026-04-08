-- Add is_skipped to cleaning_status so cleaners can skip tasks they don't want to invoice
alter table public.cleaning_status add column is_skipped boolean not null default false;
