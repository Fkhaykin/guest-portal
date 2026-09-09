-- Make run_daily_retention() actually completable from the cron.
--
-- 123 shipped the function but it timed out when called over PostgREST: the
-- comp_snapshot delete had no usable index (the only indexes lead with
-- comp_id), so it seq-scanned the whole table, and the OR across snapshot_date
-- and stay_date meant no single index could have served it anyway. A retention
-- job that always times out is the same as no retention job, which is how the
-- database filled up in the first place.

-- The scrape only ever writes stay_date >= its own snapshot_date, so a row
-- whose stay date is in the past necessarily has an old snapshot_date too and
-- is already caught by the snapshot_date cutoff. Dropping the stay_date arm
-- costs ~436 stale rows/day and makes the predicate index-friendly.
create index if not exists idx_comp_snapshot_snapshot_date
  on comp_snapshot (snapshot_date);

-- statement_timeout as a function attribute: PostgREST's per-role timeout is
-- far shorter than a bulk delete needs, and a SET on the function raises it for
-- the body of the call.
create or replace function run_daily_retention()
returns jsonb
language plpgsql
set search_path = public
set statement_timeout = '5min'
as $$
declare
  comp_rows integer;
  hook_rows integer;
begin
  -- 14 days keeps latest + previous + the ~7-days-back snapshot that the
  -- pickup signals need, with a week of slack for failed scrapes.
  delete from comp_snapshot
  where snapshot_date < current_date - 14;
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
