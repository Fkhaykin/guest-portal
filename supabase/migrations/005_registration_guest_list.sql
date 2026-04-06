-- Store individual guest names and under-21 status on registration
alter table public.registration
  add column guest_list jsonb default '[]'::jsonb;
