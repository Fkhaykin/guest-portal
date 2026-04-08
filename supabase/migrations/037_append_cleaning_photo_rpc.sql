-- Atomic append for cleaning photos to avoid race conditions
-- when multiple photos are uploaded concurrently.
create or replace function append_cleaning_photo(
  p_registration_id uuid,
  p_photo jsonb
)
returns void
language sql
as $$
  update cleaning_status
  set photos = coalesce(photos, '[]'::jsonb) || jsonb_build_array(p_photo),
      updated_at = now()
  where registration_id = p_registration_id;
$$;

-- Allow HEIF uploads (iOS sometimes reports HEIC as image/heif)
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
where id = 'cleaning-photos';
