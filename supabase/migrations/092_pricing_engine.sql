-- In-house dynamic pricing engine (PriceLabs replacement), shadow phase.
--
-- The engine computes nightly prices + min-stays per HOUSE (property nickname,
-- matched case-insensitively — a physical house can be two Lodgify listings).
-- During the shadow phase nothing is pushed to Lodgify: a daily cron stores our
-- computed rates side-by-side with what PriceLabs computed/pushed that same day
-- so the two can be compared in the Pricing Lab admin UI for ~30 days before
-- any cutover decision.

-- Per-house engine configuration. Price anchors are explicit columns; the rule
-- stack (seasons, day-of-week, events, lead-time curve, pace targets, gap
-- rules, min-stay rules, overrides) lives in `rules` jsonb — same pattern as
-- promo_code.offers/conditions.
create table if not exists pricing_config (
  id uuid primary key default gen_random_uuid(),
  nickname text not null,
  mode text not null default 'shadow' check (mode in ('off', 'shadow', 'live')),
  base_price_cents integer not null,
  min_price_cents integer not null,
  max_price_cents integer not null,
  rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_pricing_config_nickname on pricing_config (lower(nickname));

create trigger set_pricing_config_updated_at
  before update on pricing_config
  for each row execute function handle_updated_at();

-- Daily snapshot of our computed rate vs PriceLabs' rate for every future stay
-- date. One row per (house, snapshot day, stay date). pl_user_price_cents is
-- what PriceLabs actually pushed to Lodgify (their "user price"),
-- pl_price_cents is their raw recommendation. factors records every step of
-- our computation for the "why is this $389?" breakdown.
create table if not exists rate_snapshot (
  id bigint generated always as identity primary key,
  nickname text not null,
  snapshot_date date not null,
  stay_date date not null,
  our_price_cents integer,
  our_min_stay integer,
  factors jsonb,
  pl_price_cents integer,
  pl_user_price_cents integer,
  pl_min_stay integer,
  is_booked boolean not null default false,
  created_at timestamptz not null default now(),
  unique (nickname, snapshot_date, stay_date)
);

create index if not exists idx_rate_snapshot_stay on rate_snapshot (nickname, stay_date);
create index if not exists idx_rate_snapshot_day on rate_snapshot (nickname, snapshot_date);

-- Hand-picked Airbnb comparison listings per house. Our own Airbnb listings are
-- seeded with is_self = true: they benchmark the scraper against known prices
-- (our own Airbnb rate ≈ PriceLabs push + Airbnb markup) and are excluded from
-- comp aggregates.
create table if not exists comp_listing (
  id uuid primary key default gen_random_uuid(),
  nickname text not null,
  airbnb_id text not null,
  label text,
  url text,
  bedrooms integer,
  is_self boolean not null default false,
  is_active boolean not null default true,
  last_scraped_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (nickname, airbnb_id)
);

create trigger set_comp_listing_updated_at
  before update on comp_listing
  for each row execute function handle_updated_at();

-- Daily scrape snapshot per comp per stay date. Availability + min-stay come
-- from the calendar endpoint for every date; price_cents is only filled for
-- dates covered by a price probe (a handful of representative stay windows per
-- day — Airbnb only quotes prices per stay, not per calendar day).
create table if not exists comp_snapshot (
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

create index if not exists idx_comp_snapshot_stay on comp_snapshot (comp_id, stay_date);

-- RLS: hosts read, service role (admin API routes + crons) writes.
alter table pricing_config enable row level security;
alter table rate_snapshot enable row level security;
alter table comp_listing enable row level security;
alter table comp_snapshot enable row level security;

create policy "Hosts view pricing config" on pricing_config for select using (is_host());
create policy "Hosts view rate snapshots" on rate_snapshot for select using (is_host());
create policy "Hosts view comp listings" on comp_listing for select using (is_host());
create policy "Hosts view comp snapshots" on comp_snapshot for select using (is_host());
