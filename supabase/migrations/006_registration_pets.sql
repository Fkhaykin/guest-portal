-- Store pet info on registration (name, kind, document paths)
alter table public.registration
  add column pets jsonb default '[]'::jsonb;
