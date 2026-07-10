-- Idempotency guard for cleaner notifications.
--
-- Lodgify burst-delivers the same booking webhook 2-3x within a fraction of a
-- second (visible in lodgify_webhook_log). Each delivery runs syncBooking
-- concurrently; they all read the registration row before any one commits its
-- upsert, so all compute isNewBooking/justBecameActive = true and each fires
-- its own cleaner SMS + push. Result: the cleaner gets 2-3 identical texts.
-- Guest messages are protected by guest_automated_message_log; the cleaner
-- path had no equivalent guard. This table + claim function give it one.
--
-- Windowed, not permanent: pet_added / early_checkin / late_checkout can
-- legitimately re-fire over a stay (hours/days apart), so a repeat outside the
-- window is allowed while a same-instant burst collapses to a single send.

create table cleaner_notification_log (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references registration(id) on delete cascade,
  event_type text not null,
  sent_at timestamptz not null default now(),
  unique (registration_id, event_type)
);

-- Atomically claim the (registration_id, event_type) slot for a cleaner send.
-- Returns true when the caller may send (fresh slot, or the previous send is
-- older than p_window_seconds), false when a recent send already holds it. The
-- INSERT ... ON CONFLICT DO UPDATE ... WHERE runs under a row lock, so of N
-- concurrent callers in a webhook burst exactly one gets true.
create or replace function claim_cleaner_notification(
  p_registration_id uuid,
  p_event_type text,
  p_window_seconds integer default 300
) returns boolean
language plpgsql
as $$
declare
  v_claimed boolean;
begin
  insert into cleaner_notification_log (registration_id, event_type, sent_at)
  values (p_registration_id, p_event_type, now())
  on conflict (registration_id, event_type)
  do update set sent_at = now()
    where cleaner_notification_log.sent_at < now() - make_interval(secs => p_window_seconds)
  returning true into v_claimed;
  return coalesce(v_claimed, false);
end;
$$;

grant execute on function claim_cleaner_notification(uuid, text, integer) to service_role;
