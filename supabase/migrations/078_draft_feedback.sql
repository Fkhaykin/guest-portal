-- Feedback loop for AI-suggested replies.
-- Two kinds of rows:
--   * source = 'explicit': the host rejected a draft and said why (note) —
--     becomes a standing rule injected into every future generation.
--   * source = 'edit': the host edited a draft before sending — the
--     (bad_draft -> corrected_draft) pair is used as a correction example.
--   * source = 'manual': a rule added directly in the Reply Training panel.
create table if not exists draft_feedback (
  id uuid primary key default gen_random_uuid(),
  lodgify_booking_id bigint,
  source text not null check (source in ('explicit', 'edit', 'manual')),
  guest_message text,
  bad_draft text,
  corrected_draft text,
  note text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists draft_feedback_active_idx
  on draft_feedback (active, created_at desc);

-- Service-role access only (admin messenger API routes).
alter table draft_feedback enable row level security;
