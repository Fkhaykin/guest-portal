-- Hosts need to read their own properties regardless of is_active status
-- (e.g. to see and toggle inactive properties in the admin panel)
create policy "Hosts can read own properties"
  on public.property for select
  using (host_id = public.current_host_id());
