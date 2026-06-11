-- Booking context for message threads whose booking the sync skips
-- (Open/Tentative inquiries get no registration row). Lets the inbox show
-- the house + stay dates and gives the AI draft the property context.
alter table guest_message_thread
  add column if not exists lodgify_property_id bigint,
  add column if not exists arrival date,
  add column if not exists departure date,
  add column if not exists booking_status text;
