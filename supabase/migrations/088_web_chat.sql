-- Website live chat (channel = 'web').
-- Anonymous visitors can start a conversation from the marketing site before
-- they have any booking. These threads live in the same guest_message /
-- guest_message_thread tables as Lodgify and direct-booking threads, addressed
-- by thread_uid "web:<uuid>". They carry the visitor's contact details and a
-- per-thread secret token (no guest auth exists for anonymous visitors).
--
-- When a booking later arrives with the same email, linkWebThreadsToReservation
-- stamps registration_id (+ lodgify_booking_id) onto the web thread and its
-- messages, so the conversation merges into that booking's timeline — matched
-- by email across the chat -> booking boundary.

alter table guest_message_thread
  add column if not exists web_token text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists visitor_name text;

comment on column guest_message_thread.web_token is
  'Per-thread secret for anonymous web-chat visitors; required on guest read/send. NULL for non-web threads.';
comment on column guest_message_thread.email is
  'Visitor email for web-chat threads; used to merge the thread into a booking (matched by email).';

-- Hot path for linkWebThreadsToReservation and the email-inbound fallback:
-- find the unlinked web thread for a given email.
create index if not exists idx_gmt_web_email
  on guest_message_thread (lower(email))
  where channel = 'web' and registration_id is null;

-- The admin thread route now reads direct + web messages for a booking by
-- registration_id, so index it.
create index if not exists idx_guest_message_registration
  on guest_message (registration_id) where registration_id is not null;
