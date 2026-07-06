-- Split the comp median nightly price into weekend (Fri/Sat) and weeknight
-- (Sun-Thu) medians, now that the scraper probes both window types across the
-- horizon. Populated by the daily comp-scrape from the price probes.

alter table comp_listing
  add column if not exists median_weekend_cents integer,
  add column if not exists median_weeknight_cents integer;
