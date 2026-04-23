-- Cache the Lodgify messaging thread_uid on the registration so we can join
-- guest_message rows to a booking without hitting Lodgify every time.
alter table registration add column if not exists lodgify_thread_uid text;
create index if not exists idx_registration_thread_uid on registration(lodgify_thread_uid);
