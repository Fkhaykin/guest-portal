-- Per-property HOA registration fee (a COGS line: what the HOA charges us to
-- register each booking). Nullable — NULL means "use the code-level default for
-- this property's hoa_type" (see src/lib/hoa/fees.ts), so new properties and
-- unconfigured houses resolve to sensible per-HOA defaults without a backfill.
--
-- Model:
--   hoa_registration_fee_cents   base fee per booking
--   hoa_last_minute_fee_cents    higher fee when the booking lands inside the
--                                last-minute window; NULL => flat fee always
--                                (no surcharge, e.g. BMLC's $140/booking)
--   hoa_last_minute_days         window size in days before check-in (default 3)
--
-- Defaults live in code, keyed by hoa_type:
--   pepoa (Penn Estates): $45 base / $70 last-minute / 3 days
--   bmlc  (Blue Mountain Lake): $140 flat (no last-minute surcharge)
ALTER TABLE property
  ADD COLUMN IF NOT EXISTS hoa_registration_fee_cents integer,
  ADD COLUMN IF NOT EXISTS hoa_last_minute_fee_cents integer,
  ADD COLUMN IF NOT EXISTS hoa_last_minute_days integer;
