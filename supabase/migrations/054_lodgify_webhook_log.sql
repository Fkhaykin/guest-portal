-- Audit log for every incoming Lodgify webhook.
-- Captures signature failures, parse errors, and sync outcomes so we can diagnose
-- why reservations may not be appearing automatically.
create table if not exists lodgify_webhook_log (
  id uuid primary key default gen_random_uuid(),
  received_at timestamptz not null default now(),
  action text,
  lodgify_booking_id bigint,
  signature_present boolean not null default false,
  signature_valid boolean,
  status_code int not null,
  outcome text not null, -- 'signature_invalid' | 'invalid_json' | 'missing_booking_id' | 'sync_ok' | 'sync_skipped' | 'sync_failed' | 'unknown'
  skip_reason text,
  error_message text,
  duration_ms int,
  raw_payload jsonb,
  headers jsonb
);

create index idx_lodgify_webhook_log_received_at on lodgify_webhook_log(received_at desc);
create index idx_lodgify_webhook_log_booking on lodgify_webhook_log(lodgify_booking_id);
create index idx_lodgify_webhook_log_outcome on lodgify_webhook_log(outcome);

alter table lodgify_webhook_log enable row level security;

-- Hosts can read webhook logs (admin visibility)
create policy "Hosts can read lodgify webhook logs"
  on lodgify_webhook_log for select
  using (public.is_host());
