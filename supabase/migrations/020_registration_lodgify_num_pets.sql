-- Store the pet count from the Lodgify booking so we know whether the guest
-- originally booked with pets (and can charge a $100 fee for post-booking additions).
alter table public.registration
  add column lodgify_num_pets integer not null default 0;
