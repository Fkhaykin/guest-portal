-- Per-comp stat rollups, computed at scrape time so the Pricing Lab can list
-- hundreds of comps without per-comp aggregate queries.
alter table comp_listing add column if not exists occupancy_30 real;          -- 0..1 booked share next 30 days
alter table comp_listing add column if not exists median_price_cents integer; -- median probed nightly price
