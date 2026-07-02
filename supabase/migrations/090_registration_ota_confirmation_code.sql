-- OTA confirmation code on registrations
--
-- Guests booking through Airbnb/VRBO know their booking by the alphanumeric
-- confirmation code printed on the channel (e.g. "HMZBYF2B2N"), not by Lodgify's
-- numeric booking id. Until now the guest lookup only matched lodgify_booking_id,
-- so those codes never resolved. Persist the code (parsed from Lodgify's
-- source_text during sync) so the check-in lookup can match it directly.

alter table public.registration
  add column if not exists ota_confirmation_code text;

comment on column public.registration.ota_confirmation_code is
  'OTA (Airbnb/VRBO) confirmation code, parsed from Lodgify source_text.confirmationCode. Null for direct/manual bookings.';

-- No index: the guest lookup matches with case-insensitive ILIKE (~~*), which a
-- lower() b-tree cannot serve, and this table is small (low thousands of rows) so
-- the scan is sub-millisecond. Add a trigram (pg_trgm) index here only if the
-- registration count grows by an order of magnitude.
