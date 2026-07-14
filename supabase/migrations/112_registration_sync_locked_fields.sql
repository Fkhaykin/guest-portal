-- Fields an admin has manually overridden on a Lodgify-linked registration.
-- syncBooking() skips these keys when upserting from Lodgify so a manual
-- cancellation or date/guest adjustment isn't silently reverted by the next
-- webhook or full sync. Values are registration column names, e.g.
-- '{status,check_in_date,check_out_date}'.
alter table registration
  add column if not exists sync_locked_fields text[] not null default '{}';
