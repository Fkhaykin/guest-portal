-- comp_snapshot retention.
--
-- The comp scrape upserts one row per (comp listing x stay date) every
-- morning: 436 comps x a 365-day calendar horizon = ~159k rows/day, and
-- nothing ever deleted them. 67 days of that reached 10.5M rows / 2.0 GB —
-- 93% of the whole database, enough to trip the project's size quota and take
-- the portal offline (every API returning 402) on 2026-09-08.
--
-- The table is a rebuilt-daily cache, not durable history. Readers only ever
-- touch the newest few snapshot dates:
--   * aggregateMarketPulse  — latest, the one before it, and the closest one
--                             ~7 days back, for pickup_1d / pickup_7d
--   * comp calendar + self-price lookups — the latest only
-- and all of them filter to stay_date >= today. The durable history lives in
-- market_pulse, which this table is aggregated into each morning. So older
-- snapshot dates and already-past stay dates are pure dead weight.

set local statement_timeout = '30min';

-- Rebuild rather than DELETE: removing ~8 of every 9 rows would leave the dead
-- space in the heap until a VACUUM FULL, which takes an ACCESS EXCLUSIVE lock
-- and cannot run inside a migration's transaction. Building a fresh table and
-- swapping it in returns the space to the OS as soon as this commits.
create table comp_snapshot_rebuild (
  id bigint generated always as identity primary key,
  comp_id uuid not null references comp_listing(id) on delete cascade,
  snapshot_date date not null,
  stay_date date not null,
  available boolean,
  min_nights integer,
  price_cents integer,
  created_at timestamptz not null default now(),
  unique (comp_id, snapshot_date, stay_date)
);

-- id is not referenced by anything, so let it regenerate rather than copying it.
insert into comp_snapshot_rebuild
  (comp_id, snapshot_date, stay_date, available, min_nights, price_cents, created_at)
select comp_id, snapshot_date, stay_date, available, min_nights, price_cents, created_at
from comp_snapshot
where snapshot_date >= current_date - 13
  and stay_date >= current_date;

drop table comp_snapshot;

alter table comp_snapshot_rebuild rename to comp_snapshot;

-- Restore the original constraint/index names so later diffs stay readable.
alter table comp_snapshot
  rename constraint comp_snapshot_rebuild_pkey to comp_snapshot_pkey;
alter table comp_snapshot
  rename constraint comp_snapshot_rebuild_comp_id_fkey to comp_snapshot_comp_id_fkey;
alter table comp_snapshot
  rename constraint comp_snapshot_rebuild_comp_id_snapshot_date_stay_date_key
  to comp_snapshot_comp_id_snapshot_date_stay_date_key;

create index idx_comp_snapshot_stay on comp_snapshot (comp_id, stay_date);

-- RLS and policies are not carried over by the swap; re-apply 092's.
alter table comp_snapshot enable row level security;
create policy "Hosts view comp snapshots" on comp_snapshot for select using (is_host());

comment on table comp_snapshot is
  'Daily comp calendar cache. Pruned to the last 14 snapshot dates by '
  'run_daily_retention(); durable history lives in market_pulse.';

-- Ongoing retention, so this cannot silently rebuild. Called once a day by
-- /api/cron/market-pulse, which runs after the morning scrapes and is the last
-- reader of the older snapshots.
create or replace function run_daily_retention()
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  comp_rows integer;
  hook_rows integer;
begin
  -- 14 days keeps latest + previous + the ~7-days-back snapshot that the
  -- pickup signals need, with a week of slack for failed scrapes.
  delete from comp_snapshot
  where snapshot_date < current_date - 14
     or stay_date < current_date - 1;
  get diagnostics comp_rows = row_count;

  -- Webhook debugging log: ~5 KB of raw_payload per row, also unbounded.
  delete from lodgify_webhook_log
  where received_at < now() - interval '90 days';
  get diagnostics hook_rows = row_count;

  return jsonb_build_object(
    'comp_snapshot', comp_rows,
    'lodgify_webhook_log', hook_rows
  );
end;
$$;

revoke all on function run_daily_retention() from public;
grant execute on function run_daily_retention() to service_role;
