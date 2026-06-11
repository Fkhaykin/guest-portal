-- AI-suggested reply drafts for the admin messenger.
-- One row per booking: the draft for the conversation's current state,
-- keyed by a hash of the last guest message so stale drafts regenerate.
create table if not exists message_draft (
  lodgify_booking_id bigint primary key,
  draft text not null,
  last_guest_message_hash text not null,
  generated_at timestamptz not null default now()
);

-- Service-role access only (admin messenger API routes).
alter table message_draft enable row level security;
