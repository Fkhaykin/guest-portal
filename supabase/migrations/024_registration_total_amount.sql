-- Store Lodgify booking revenue on registrations
ALTER TABLE registration
  ADD COLUMN IF NOT EXISTS total_amount_cents integer DEFAULT 0;

COMMENT ON COLUMN registration.total_amount_cents IS 'Booking revenue in cents, synced from Lodgify total_amount';
