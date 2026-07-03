-- Coordinates + bedroom/rating cache for comp listings, so the Pricing Lab can
-- render a PriceLabs-style competitor map and bedroom-matched compset stats.
-- Populated from each listing's Airbnb page when a comp is added or discovered.

alter table comp_listing add column if not exists lat double precision;
alter table comp_listing add column if not exists lng double precision;
alter table comp_listing add column if not exists bedrooms integer;
alter table comp_listing add column if not exists rating double precision;
alter table comp_listing add column if not exists review_count integer;

-- House anchor coordinates live on the is_self comp row; no extra table needed.
