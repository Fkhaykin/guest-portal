-- Market pulse: daily pre-aggregated comp-set signals per house per stay date,
-- so the engine and UI read one cheap row instead of re-scanning thousands of
-- comp_snapshot rows. Written by /api/cron/market-pulse after the day's comp
-- scrapes finish.
--
-- pickup_7d is the booking-velocity signal: of the comps that had this stay
-- date open ~7 snapshot days ago, what fraction has since gone unavailable.
-- The engine's velocity factor turns high pickup into a price premium.

create table if not exists market_pulse (
  id bigint generated always as identity primary key,
  nickname text not null,
  snapshot_date date not null,
  stay_date date not null,
  comps_tracked integer not null default 0,
  comps_available integer not null default 0,
  occupancy real,               -- 0..1 fraction of comps unavailable
  pickup_1d real,               -- fraction booked since previous snapshot
  pickup_7d real,               -- fraction booked over ~7 snapshot days
  p25_cents integer,
  p50_cents integer,
  p75_cents integer,
  p90_cents integer,
  prices_counted integer not null default 0,
  lf_comps_tracked integer,     -- lakefront-only aggregates (Lakehouse / Mansion)
  lf_occupancy real,
  lf_p50_cents integer,
  created_at timestamptz not null default now(),
  unique (nickname, snapshot_date, stay_date)
);

create index if not exists idx_market_pulse_latest on market_pulse (nickname, snapshot_date desc, stay_date);

alter table market_pulse enable row level security;
create policy "Hosts view market pulse" on market_pulse for select using (is_host());

-- Comp metadata for the expanded comp program: lakefront flag (detected from
-- the listing page; matters for Lakehouse and Mansion/BML which are truly
-- lakefront) and price-probe rotation bookkeeping.
alter table comp_listing add column if not exists is_lakefront boolean not null default false;
alter table comp_listing add column if not exists last_priced_at timestamptz;
