-- Effectiveness tracking for AI-suggested guest-message replies.
-- One row per AI draft the host acted on in the admin messenger:
--   * accepted  -> sent as-is (whitespace-only differences count as accepted)
--   * edited    -> edited before sending; distance/percent_changed measure how much
--   * discarded -> cleared without sending
-- Powers the acceptance-rate trend (admin > Auto Messages) we watch until drafts
-- are good enough to send automatically. This is a metrics log, distinct from
-- draft_feedback (the training loop, which only captures edits & rules).
create table if not exists draft_outcome (
  id uuid primary key default gen_random_uuid(),
  -- Numeric Lodgify booking id when available; null for direct/web bookings
  -- (their ids are registration UUIDs / web thread uids, kept in booking_ref).
  lodgify_booking_id bigint,
  -- Raw booking identifier as the messenger sees it (number, registration
  -- UUID, or web thread uid) so every outcome stays attributable.
  booking_ref text,
  -- House the conversation belongs to (nickname) for per-home rates. NULL = unknown.
  house text check (house is null or house in ('lakehouse', 'chalet', 'manor', 'cottage', 'mansion')),
  outcome text not null check (outcome in ('accepted', 'edited', 'discarded')),
  -- Character lengths + Levenshtein distance between the AI draft and what was
  -- sent, on whitespace-normalized text. distance/percent_changed are 0 for
  -- accepted and null for discarded (nothing was sent).
  draft_length int,
  sent_length int,
  distance int,
  percent_changed numeric(5, 2),
  -- Hash of the guest message the draft answered (matches
  -- message_draft.last_guest_message_hash) — ties an outcome back to its draft.
  guest_message_hash text,
  created_at timestamptz not null default now()
);

create index if not exists draft_outcome_created_idx on draft_outcome (created_at desc);
create index if not exists draft_outcome_outcome_idx on draft_outcome (outcome, created_at desc);

-- Service-role access only (admin messenger API routes).
alter table draft_outcome enable row level security;
