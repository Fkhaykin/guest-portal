-- AirCover claims: damage reports and pet discrepancy claims from cleaners
create table if not exists aircover_claim (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references registration(id) on delete cascade,
  property_id uuid not null references property(id) on delete cascade,
  cleaner_id uuid references cleaner(id) on delete set null,
  claim_type text not null check (claim_type in ('damage', 'pet_discrepancy')),
  status text not null default 'open' check (status in ('open', 'claim_filed', 'claim_approved', 'claim_denied')),

  -- Damage fields
  damage_description text,
  damage_photos text[] not null default '{}',

  -- Pet discrepancy fields
  pet_description text,
  reported_pet_count int,
  reported_pet_labels text[] not null default '{}', -- e.g. ['dog', 'cat']
  expected_pet_count int, -- from registration or lodgify

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_aircover_claim_registration on aircover_claim(registration_id);
create index idx_aircover_claim_property on aircover_claim(property_id);
create index idx_aircover_claim_status on aircover_claim(status);

-- Updated_at trigger
create trigger set_aircover_claim_updated_at
  before update on aircover_claim
  for each row execute function handle_updated_at();

-- Storage bucket for damage photos
insert into storage.buckets (id, name, public)
values ('damage-photos', 'damage-photos', false)
on conflict (id) do nothing;

-- Storage policy: cleaners upload via service role (API routes), admin reads
create policy "Service role full access on damage-photos"
  on storage.objects for all
  using (bucket_id = 'damage-photos')
  with check (bucket_id = 'damage-photos');
