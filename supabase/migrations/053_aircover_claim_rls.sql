-- Enable RLS on aircover_claim (may already be enabled on hosted Supabase)
alter table public.aircover_claim enable row level security;

-- Hosts can read claims for their own properties
create policy "Hosts can read own property claims"
  on public.aircover_claim for select
  using (
    property_id in (
      select id from public.property
      where host_id = public.current_host_id()
    )
  );

-- Hosts can update claims for their own properties (status changes)
create policy "Hosts can update own property claims"
  on public.aircover_claim for update
  using (
    property_id in (
      select id from public.property
      where host_id = public.current_host_id()
    )
  );
