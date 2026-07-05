-- In-house kiosk display: one secret URL token per property.
-- Token deliberately NOT a property column: property SELECT is using(true)
-- (052_allow_read_all_properties.sql) and the guest layout ships select("*")
-- to the client, so any property column is publicly readable.
create table public.kiosk (
  property_id uuid primary key references public.property(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now(),
  rotated_at timestamptz
);

alter table public.kiosk enable row level security;
-- No policies on purpose: service-role access only. Anon/authenticated see nothing.

insert into public.kiosk (property_id)
select id from public.property where is_active = true
on conflict (property_id) do nothing;
