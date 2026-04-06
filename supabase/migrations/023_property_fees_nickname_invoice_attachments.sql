-- ============================================
-- Property: nickname + fee configuration
-- ============================================

alter table public.property
  add column nickname text,
  add column cleaning_fee_cents integer not null default 0,
  add column pet_fee_cents integer not null default 0;

-- ============================================
-- Invoice: adjustments + file attachments
-- ============================================

alter table public.cleaner_invoice
  add column adjustments jsonb not null default '[]'::jsonb,
  add column attachments jsonb not null default '[]'::jsonb;
-- adjustments format: [{description: string, amount: integer (cents), reason: string}]
-- attachments format: [{name: string, path: string, uploaded_at: string}]

-- ============================================
-- Storage bucket for invoice attachments
-- ============================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'invoice-attachments',
  'invoice-attachments',
  false,
  10485760, -- 10 MiB
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

-- ============================================
-- Storage bucket for property images
-- ============================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'property-images',
  'property-images',
  true,
  5242880, -- 5 MiB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;
