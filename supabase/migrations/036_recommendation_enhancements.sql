-- Add youtube_url and tips columns to recommendation
alter table public.recommendation add column if not exists youtube_url text;
alter table public.recommendation add column if not exists tips text;

-- Expand category options
alter table public.recommendation drop constraint if exists recommendation_category_check;
alter table public.recommendation add constraint recommendation_category_check
  check (category in ('restaurant', 'cafe', 'bar', 'bakery', 'attraction', 'activity', 'shopping', 'nightlife', 'spa', 'nature', 'family', 'sports', 'other'));
