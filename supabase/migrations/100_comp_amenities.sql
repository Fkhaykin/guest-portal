-- Comp amenity + size detail for the Pricing Lab comp table: bathroom count and
-- the amenity flags hosts sort comps by (hot tub / sauna / game room), plus
-- 60- and 90-day occupancy rollups alongside the existing 30-day one. Amenities
-- and bathrooms are scraped once from each listing's Airbnb page (static);
-- occupancy_60/90 are recomputed by the daily comp-scrape from the calendar.

alter table comp_listing
  add column if not exists bathrooms numeric,
  add column if not exists has_hot_tub boolean,
  add column if not exists has_sauna boolean,
  add column if not exists has_game_room boolean,
  add column if not exists occupancy_60 numeric,
  add column if not exists occupancy_90 numeric;
