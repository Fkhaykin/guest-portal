-- Store pre-loaded tips on registration
alter table public.registration
  add column if not exists tips jsonb default '{}'::jsonb;
