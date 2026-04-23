-- Persist Lodgify guest messages so the admin messages UI can read from our DB
-- instead of hitting Lodgify's API on every page load. Populated by the
-- guest_message_received webhook (incoming messages) and by thread syncs that
-- also capture Owner replies sent via Lodgify.

create table if not exists guest_message (
  id uuid primary key default gen_random_uuid(),
  -- Lodgify identifiers. message_id is unique per Lodgify message; thread_uid
  -- groups messages in a conversation; inbox_uid is the channel inbox (e.g.
  -- "B18786126" for Airbnb). booking_id is best-effort — webhooks for
  -- guest_message_received don't include it, so it's filled when we can
  -- resolve the thread via the Lodgify booking API.
  lodgify_message_id bigint not null unique,
  thread_uid text not null,
  inbox_uid text,
  lodgify_booking_id bigint,

  -- Sender direction. "Renter" (guest) for webhook-delivered messages,
  -- "Owner" for messages we send, "Comment" or others for internal notes.
  message_type text not null default 'Renter',

  guest_name text,
  subject text,
  message text not null default '',
  has_attachments boolean not null default false,
  sub_owner_id text,

  -- Lodgify's creation time for the message; received_at is when we stored it.
  creation_time timestamptz,
  received_at timestamptz not null default now()
);

create index idx_guest_message_thread on guest_message(thread_uid, creation_time desc);
create index idx_guest_message_booking on guest_message(lodgify_booking_id);
create index idx_guest_message_creation on guest_message(creation_time desc);

alter table guest_message enable row level security;

create policy "Hosts can read guest messages"
  on guest_message for select
  using (public.is_host());

-- Thread-level metadata (last message, read state, linked booking). Populated
-- by the same webhook + sync paths. One row per thread_uid.
create table if not exists guest_message_thread (
  thread_uid text primary key,
  inbox_uid text,
  lodgify_booking_id bigint,
  guest_name text,
  last_message_at timestamptz,
  last_message_preview text,
  unread_count int not null default 0,
  updated_at timestamptz not null default now()
);

create index idx_guest_message_thread_booking on guest_message_thread(lodgify_booking_id);
create index idx_guest_message_thread_last on guest_message_thread(last_message_at desc);

alter table guest_message_thread enable row level security;

create policy "Hosts can read guest message threads"
  on guest_message_thread for select
  using (public.is_host());
