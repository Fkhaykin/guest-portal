-- Cover photo per comp for the comp table thumbnail. Scraped once from the
-- listing's Airbnb page (og:image), same enrichment pass as amenities.

alter table comp_listing
  add column if not exists photo_url text;
