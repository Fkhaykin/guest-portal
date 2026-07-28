-- Reliable delivery tracking for new-booking alerts (host + cleaner).
--
-- Incident (booking 22101735): Lodgify burst-delivered the webhook 3x in ~2s.
-- One concurrent syncBooking won the cleaner dedup claim (cleaner_notification_log)
-- and proceeded to notify, but its awaited sends — cleaner SMS + push AND the host
-- push, all in one Promise.all with swallowed errors — never landed (most likely
-- the serverless instance was frozen mid-send when a sibling burst-request returned
-- first). Because the old claim is written BEFORE the send and never released on
-- failure, it recorded a phantom "sent" that also blocked any retry. Net: neither
-- the cleaner nor the host got anything, and nothing could recover it.
--
-- This table tracks each alert through claim -> sent, so we can (a) atomically
-- dedup a burst, (b) tell a real delivery from a claimed-but-killed one, and
-- (c) let a backstop re-send anything that never confirmed.

create table booking_notification (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references registration(id) on delete cascade,
  channel text not null,                       -- 'host' | 'cleaner'
  event_type text not null default 'new_booking',
  status text not null default 'claimed',      -- 'claimed' | 'sent'
  claimed_at timestamptz not null default now(),
  sent_at timestamptz,
  attempts integer not null default 1,
  unique (registration_id, channel, event_type)
);

-- Backstop scan: "recently claimed but not yet sent".
create index booking_notification_pending_idx
  on booking_notification (status, claimed_at);

-- Atomically claim the (registration, channel, event_type) slot. Returns true
-- when the caller should send:
--   * fresh slot (no row yet), OR
--   * a prior CLAIM that never confirmed and is older than p_stale_claim_seconds
--     (the previous attempt was killed — allow a retry), OR
--   * a confirmed SEND older than p_sent_window_seconds (legit re-fire window).
-- The INSERT ... ON CONFLICT DO UPDATE ... WHERE runs under a row lock, so of N
-- concurrent callers in a webhook burst exactly one gets true.
create or replace function claim_booking_notification(
  p_registration_id uuid,
  p_channel text,
  p_event_type text default 'new_booking',
  p_sent_window_seconds integer default 300,
  p_stale_claim_seconds integer default 120
) returns boolean
language plpgsql
as $$
declare
  v_claimed boolean;
begin
  insert into booking_notification (registration_id, channel, event_type, status)
  values (p_registration_id, p_channel, p_event_type, 'claimed')
  on conflict (registration_id, channel, event_type)
  do update set
    claimed_at = now(),
    attempts   = booking_notification.attempts + 1,
    status     = 'claimed',
    sent_at    = null
    where
      (booking_notification.status = 'sent'
        and booking_notification.sent_at < now() - make_interval(secs => p_sent_window_seconds))
      or (booking_notification.status = 'claimed'
        and booking_notification.claimed_at < now() - make_interval(secs => p_stale_claim_seconds))
  returning true into v_claimed;
  return coalesce(v_claimed, false);
end;
$$;

grant execute on function claim_booking_notification(uuid, text, text, integer, integer) to service_role;

-- Seed existing recent active bookings as already-delivered so the backstop
-- starts from a clean baseline and does not blast duplicate alerts for bookings
-- that were notified (or intentionally handled) before this shipped. Re-sending
-- the one alert that actually failed (booking 22101735, a same-day check-in) is
-- left as a deliberate manual call, not an automatic late text to the cleaner.
insert into booking_notification (registration_id, channel, event_type, status, claimed_at, sent_at)
select r.id, ch.channel, 'new_booking', 'sent', now(), now()
from registration r
cross join (values ('host'::text), ('cleaner'::text)) as ch(channel)
where r.status = 'active'
  and r.created_at > now() - interval '30 days'
on conflict (registration_id, channel, event_type) do nothing;
