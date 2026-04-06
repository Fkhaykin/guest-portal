-- Create the registrations storage bucket for signature uploads
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'registrations',
  'registrations',
  false,
  2097152, -- 2 MiB
  array['image/png', 'image/jpeg']
)
on conflict (id) do nothing;

-- Allow the service role (used by admin client in API routes) full access
-- No public/anon access needed since uploads go through the API route
