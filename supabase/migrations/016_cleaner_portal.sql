-- ============================================
-- Cleaner Portal — Tables, RLS, Triggers
-- ============================================

-- ============================================
-- CLEANERS (per-host cleaner accounts)
-- ============================================
create table public.cleaner (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.host(id) on delete cascade,
  name text not null,
  password_hash text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_cleaner_host on public.cleaner(host_id);

-- ============================================
-- CLEANER ↔ PROPERTY ASSIGNMENTS
-- ============================================
create table public.cleaner_property (
  id uuid primary key default gen_random_uuid(),
  cleaner_id uuid not null references public.cleaner(id) on delete cascade,
  property_id uuid not null references public.property(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(cleaner_id, property_id)
);

create index idx_cleaner_property_cleaner on public.cleaner_property(cleaner_id);
create index idx_cleaner_property_property on public.cleaner_property(property_id);

-- ============================================
-- CLEANER SESSIONS (DB-backed auth tokens)
-- ============================================
create table public.cleaner_session (
  id uuid primary key default gen_random_uuid(),
  cleaner_id uuid not null references public.cleaner(id) on delete cascade,
  token text unique not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index idx_cleaner_session_token on public.cleaner_session(token);

-- ============================================
-- CLEANING STATUS (per-registration tracking)
-- ============================================
create table public.cleaning_status (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registration(id) on delete cascade unique,
  cleaner_id uuid references public.cleaner(id) on delete set null,
  is_cleaned boolean not null default false,
  cleaned_at timestamptz,
  fulfilled_upsells text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_cleaning_status_registration on public.cleaning_status(registration_id);
create index idx_cleaning_status_cleaner on public.cleaning_status(cleaner_id);

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================
create trigger set_updated_at before update on public.cleaner
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.cleaning_status
  for each row execute function public.handle_updated_at();

-- ============================================
-- RLS POLICIES
-- ============================================
alter table public.cleaner enable row level security;
alter table public.cleaner_property enable row level security;
alter table public.cleaner_session enable row level security;
alter table public.cleaning_status enable row level security;

-- Hosts manage their own cleaners
create policy "Hosts can manage own cleaners"
  on public.cleaner for all
  using (host_id = public.current_host_id());

-- Hosts manage cleaner-property assignments for their cleaners
create policy "Hosts can manage own cleaner assignments"
  on public.cleaner_property for all
  using (
    cleaner_id in (
      select c.id from public.cleaner c where c.host_id = public.current_host_id()
    )
  );

-- No public policies on cleaner_session (admin client only)

-- Hosts can read cleaning status for their properties
create policy "Hosts can read cleaning status"
  on public.cleaning_status for select
  using (
    registration_id in (
      select r.id from public.registration r
      join public.property p on p.id = r.property_id
      where p.host_id = public.current_host_id()
    )
  );
