-- Kiosk device gate: the kiosk URL is visible in the wall device's address
-- bar, so a guest could retype it at home and read the CURRENT guest's
-- booking (the main kiosk payload hands out a signed guest token). A
-- one-time-per-device PIN closes that: entering it exchanges for the row's
-- device_key, which the device stores and sends on every payload fetch.
-- Rotating the PIN does NOT de-authorize devices (device_key is unchanged);
-- rotating the URL token remains the nuclear option.
alter table public.kiosk
  -- random() is volatile, so the default is evaluated per existing row —
  -- every house gets its own PIN on migrate.
  add column pin text not null default lpad(floor(random() * 1000000)::int::text, 6, '0'),
  add column device_key uuid not null default gen_random_uuid();
