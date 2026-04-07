-- Add booked_at column to track when the booking was actually made (from Lodgify)
alter table public.registration
  add column booked_at timestamptz;
