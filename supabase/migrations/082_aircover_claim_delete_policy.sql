-- Hosts can delete claims for their own properties
create policy "Hosts can delete own property claims"
  on public.aircover_claim for delete
  using (
    property_id in (
      select id from public.property
      where host_id = public.current_host_id()
    )
  );
