-- Channel a thread arrived on (Lodgify's per-message "route": Vrbo, Airbnb,
-- Booking.com, etc.). Pre-booking enquiries have no registration to read a
-- booking_source from, so without this they showed in the inbox with no
-- source at all. Derived from the live Lodgify thread on webhook/backfill.
alter table guest_message_thread
  add column if not exists channel text;
