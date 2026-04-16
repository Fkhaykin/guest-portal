-- Allow guests to access properties regardless of is_active status.
-- Guests with valid bookings need to reach registration/portal pages
-- even when a property is marked inactive in the admin panel.
drop policy "Anyone can read active properties" on public.property;

create policy "Anyone can read properties"
  on public.property for select
  using (true);
