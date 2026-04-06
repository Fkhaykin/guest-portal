-- Storage bucket for cleaning verification photos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cleaning-photos',
  'cleaning-photos',
  false,
  5242880, -- 5 MiB per photo
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

-- Add photos column to cleaning_status
alter table public.cleaning_status
  add column photos jsonb default '[]'::jsonb;
-- photos format: [{room: string, path: string, uploaded_at: string}]

-- Add checklist column to cleaning_status
alter table public.cleaning_status
  add column checklist jsonb default '[]'::jsonb;
-- checklist format: [{item: string, room: string, checked: boolean}]
