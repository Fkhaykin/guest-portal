-- Idempotency guard for HOA registration emails.
--
-- submitPEPOAEmail fires from several paths: the guest register flow, guest
-- vehicle/driver edits, and Lodgify date-change webhooks. Lodgify burst-delivers
-- the same booking webhook 2-3x within a fraction of a second (same root cause
-- as cleaner_notification_log / migration 105), and a guest double-submit or a
-- Vercel retry can re-run the register flow. Each path sends a fresh HOA email
-- with no dedup, so the HOA receives duplicates. This table + claim function
-- collapse same-instant / same-content repeats to a single send.
--
-- Windowed: an initial send is claimed effectively permanently (the caller
-- passes a huge window), while update sends key on the change summary and use a
-- short window so a genuinely different change later still goes out. A manual
-- admin "Email to HOA" (force=true) bypasses the claim entirely.

create table hoa_email_claim (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references registration(id) on delete cascade,
  event_key text not null,
  sent_at timestamptz not null default now(),
  unique (registration_id, event_key)
);

-- Atomically claim the (registration_id, event_key) slot for an HOA send.
-- Returns true when the caller may send (fresh slot, or the previous send is
-- older than p_window_seconds), false when a recent send already holds it. The
-- INSERT ... ON CONFLICT DO UPDATE ... WHERE runs under a row lock, so of N
-- concurrent callers in a webhook burst exactly one gets true.
create or replace function claim_hoa_email(
  p_registration_id uuid,
  p_event_key text,
  p_window_seconds integer default 300
) returns boolean
language plpgsql
as $$
declare
  v_claimed boolean;
begin
  insert into hoa_email_claim (registration_id, event_key, sent_at)
  values (p_registration_id, p_event_key, now())
  on conflict (registration_id, event_key)
  do update set sent_at = now()
    where hoa_email_claim.sent_at < now() - make_interval(secs => p_window_seconds)
  returning true into v_claimed;
  return coalesce(v_claimed, false);
end;
$$;

grant execute on function claim_hoa_email(uuid, text, integer) to service_role;
