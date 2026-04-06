-- ============================================
-- Lodgify Integration — Schema Changes
-- ============================================

-- Add Lodgify property mapping
alter table public.property
  add column lodgify_property_id bigint unique;

create index idx_property_lodgify on public.property(lodgify_property_id);

-- Make guest.auth_user_id nullable for Lodgify-sourced guests
-- (they won't have a Supabase Auth account until they log in)
alter table public.guest
  alter column auth_user_id drop not null;

-- Add Lodgify guest mapping
alter table public.guest
  add column lodgify_guest_id text unique;

create index idx_guest_lodgify on public.guest(lodgify_guest_id);

-- Add Lodgify booking mapping to registration
alter table public.registration
  add column lodgify_booking_id bigint unique;

create index idx_registration_lodgify on public.registration(lodgify_booking_id);

-- Track last sync time for properties
alter table public.property
  add column lodgify_last_synced_at timestamptz;

-- ============================================
-- RLS policy for guest lookup (no auth required)
-- Guests can look up their own registration by
-- matching email/phone + name + check_in_date
-- This is handled via the service role in the API,
-- so no additional RLS policies are needed here.
-- ============================================
