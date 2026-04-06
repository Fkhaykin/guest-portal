-- ============================================
-- Guest Portal — Initial Schema
-- ============================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ============================================
-- HOSTS (admin users)
-- ============================================
create table public.host (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique not null,
  email text unique not null,
  full_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================
-- PROPERTIES
-- ============================================
create table public.property (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.host(id) on delete cascade,
  name text not null,
  slug text unique not null,
  address text,
  description text,
  timezone text not null default 'America/New_York',
  cover_image_url text,
  theme_config jsonb not null default '{}',
  stripe_account_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_property_slug on public.property(slug);
create index idx_property_host on public.property(host_id);

-- ============================================
-- GUESTS
-- ============================================
create table public.guest (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique not null,
  email text,
  phone text,
  full_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================
-- REGISTRATIONS
-- ============================================
create table public.registration (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.property(id) on delete cascade,
  guest_id uuid not null references public.guest(id) on delete cascade,
  check_in_date date not null,
  check_out_date date not null,
  num_guests integer not null default 1,
  notes text,
  status text not null default 'active'
    check (status in ('active', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_registration_property on public.registration(property_id);
create index idx_registration_guest on public.registration(guest_id);

-- ============================================
-- VEHICLES
-- ============================================
create table public.vehicle (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registration(id) on delete cascade,
  make text,
  model text,
  color text,
  license_plate text not null,
  state_or_region text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_vehicle_registration on public.vehicle(registration_id);

-- ============================================
-- SERVICES (purchasable add-ons)
-- ============================================
create table public.service (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.property(id) on delete cascade,
  name text not null,
  description text,
  price_cents integer not null,
  currency text not null default 'usd',
  image_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_service_property on public.service(property_id);

-- ============================================
-- PAYMENTS
-- ============================================
create table public.payment (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid references public.registration(id) on delete set null,
  service_id uuid references public.service(id) on delete set null,
  guest_id uuid not null references public.guest(id) on delete cascade,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  amount_cents integer not null,
  currency text not null default 'usd',
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'failed', 'refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_payment_guest on public.payment(guest_id);
create index idx_payment_registration on public.payment(registration_id);

-- ============================================
-- VIDEOS
-- ============================================
create table public.video (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.property(id) on delete cascade,
  title text not null,
  description text,
  storage_path text not null,
  thumbnail_url text,
  duration_seconds integer,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_video_property on public.video(property_id);

-- ============================================
-- QR CODES
-- ============================================
create table public.qr_code (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.property(id) on delete cascade,
  code text unique not null,
  label text not null,
  target_type text not null
    check (target_type in ('video', 'home', 'services', 'faq', 'registration', 'custom_url')),
  target_id uuid,
  custom_url text,
  scan_count integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_qr_code_property on public.qr_code(property_id);
create unique index idx_qr_code_code on public.qr_code(code);

-- ============================================
-- FAQS
-- ============================================
create table public.faq (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.property(id) on delete cascade,
  question text not null,
  answer text not null,
  category text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_faq_property on public.faq(property_id);

-- ============================================
-- PROMOTIONS
-- ============================================
create table public.promotion (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.property(id) on delete cascade,
  title text not null,
  description text,
  image_url text,
  promo_code text,
  valid_from timestamptz,
  valid_until timestamptz,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_promotion_property on public.promotion(property_id);

-- ============================================
-- RECOMMENDATIONS
-- ============================================
create table public.recommendation (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.property(id) on delete cascade,
  name text not null,
  category text not null
    check (category in ('restaurant', 'attraction', 'activity', 'shopping', 'other')),
  description text,
  address text,
  website_url text,
  map_url text,
  image_url text,
  rating numeric(2,1),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_recommendation_property on public.recommendation(property_id);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply trigger to all tables
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'host', 'property', 'guest', 'registration', 'vehicle',
      'service', 'payment', 'video', 'qr_code', 'faq',
      'promotion', 'recommendation'
    ])
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I
       for each row execute function public.handle_updated_at()',
      t
    );
  end loop;
end;
$$;
