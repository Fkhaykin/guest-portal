-- Guest WiFi for the kiosk welcome screen (QR + credentials).
-- Lives on the kiosk table, NOT property: property SELECT is using(true) and the
-- guest layout ships select("*") to every browser (see 099_kiosk.sql), so a
-- property column would leak the password globally. The kiosk table is
-- service-role only, and the wifi is surfaced solely through the device-gated
-- kiosk payload.
alter table public.kiosk
  add column if not exists wifi_ssid text,
  add column if not exists wifi_password text;

-- Seed the Lakehouse kiosk (the only active "Lakehouse" property carries a kiosk).
update public.kiosk k
set wifi_ssid = 'Lakehouse',
    wifi_password = 'relax449'
from public.property p
where k.property_id = p.id
  and p.nickname ilike 'lakehouse'
  and p.is_active = true;
