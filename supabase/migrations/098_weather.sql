-- Near-term weather forecast per house, the input to the engine's weather
-- factor (a differentiator — PriceLabs does not price on weather). Refreshed
-- daily from Open-Meteo (free, no key) for each house's coordinates; only the
-- ~16-day forecast horizon is meaningful, so rows are near-term only.
create table if not exists weather_forecast (
  id bigint generated always as identity primary key,
  nickname text not null,
  stay_date date not null,
  fetched_at timestamptz not null default now(),
  temp_max_f real,
  temp_min_f real,
  precip_prob integer,          -- max precipitation probability, %
  precip_mm real,               -- precipitation sum, mm
  weather_code integer,         -- WMO code
  desirability real,            -- 0..1 warm-and-dry-getaway score
  unique (nickname, stay_date)
);
create index if not exists idx_weather_forecast on weather_forecast (nickname, stay_date);

alter table weather_forecast enable row level security;
create policy "Hosts view weather" on weather_forecast for select using (is_host());
