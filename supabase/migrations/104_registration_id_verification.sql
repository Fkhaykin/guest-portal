-- Stripe Identity verification for direct (non-Airbnb) bookings.
-- Replaces the old write-only ID photo upload with a real document + selfie
-- check. Status is driven by Stripe webhooks / client polling.

alter table registration
  add column if not exists id_verification_status text not null default 'unstarted',
  add column if not exists id_verification_session_id text,
  add column if not exists id_verified_name text,
  add column if not exists id_name_match boolean,
  add column if not exists id_verified_at timestamptz;

comment on column registration.id_verification_status is
  'Stripe Identity outcome: unstarted | processing | verified | requires_input';
comment on column registration.id_verification_session_id is
  'Stripe Identity VerificationSession id (vs_...)';
comment on column registration.id_name_match is
  'Whether the ID-extracted name matches the booking guest name (host-review flag)';

create index if not exists idx_registration_id_verification_session
  on registration (id_verification_session_id);
