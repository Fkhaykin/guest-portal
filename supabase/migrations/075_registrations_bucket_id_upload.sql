-- Widen the `registrations` bucket so guests can upload phone photos of their ID.
-- Original bucket (009) was sized for tiny signature PNGs only.
update storage.buckets
set
  file_size_limit = 10485760, -- 10 MiB
  allowed_mime_types = array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/pdf'
  ]
where id = 'registrations';
