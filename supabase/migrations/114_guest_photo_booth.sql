-- Photo Booth: guests snap photos on the house kiosk. Each photo the guest
-- keeps enters a two-gate moderation flow —
--   guest_approved  (guest kept it → shows in their album + admin review queue)
--   published       (admin approved → house album: kiosk tile + website)
--   rejected        (admin passed → stays out of the house album)
-- Photos the guest deletes/retakes before keeping are never uploaded.
--
-- Supersedes the 051 stub (dropped in 073). All reads sign URLs server-side via
-- the service-role client, so the bucket stays private with no public policy.
create table if not exists guest_photo (
  id uuid primary key default gen_random_uuid(),
  -- Kept if the reservation is later removed so published house photos survive.
  registration_id uuid references registration(id) on delete set null,
  property_id uuid not null references property(id) on delete cascade,
  file_path text not null,
  taken_by_name text,
  status text not null default 'guest_approved'
    check (status in ('guest_approved', 'published', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

-- House album reads filter (property, status) and order by recency.
create index idx_guest_photo_property_status
  on guest_photo(property_id, status, created_at desc);
-- Guest album reads filter by their reservation.
create index idx_guest_photo_registration on guest_photo(registration_id);

create trigger set_guest_photo_updated_at
  before update on guest_photo
  for each row execute function handle_updated_at();

alter table guest_photo enable row level security;

-- Hosts see and moderate photos on their own properties (the admin dashboard
-- uses the RLS-scoped client). Kiosk + website access runs through the
-- service-role client, which bypasses RLS.
create policy "Hosts manage guest photos on their properties"
  on guest_photo for all
  using (
    property_id in (select id from public.property where host_id = public.current_host_id())
  )
  with check (
    property_id in (select id from public.property where host_id = public.current_host_id())
  );

-- Private bucket — 8 MiB is plenty for a kiosk JPEG snapshot.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'guest-photos',
  'guest-photos',
  false,
  8388608, -- 8 MiB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- All object access is server-side via the service-role client (which bypasses
-- RLS); this policy just documents that no other role may touch the bucket.
create policy "Service role manages guest photos"
  on storage.objects for all
  to service_role
  using (bucket_id = 'guest-photos')
  with check (bucket_id = 'guest-photos');
