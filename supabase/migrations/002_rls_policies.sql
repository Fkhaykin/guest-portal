-- ============================================
-- Row Level Security Policies
-- ============================================

-- Enable RLS on all tables
alter table public.host enable row level security;
alter table public.property enable row level security;
alter table public.guest enable row level security;
alter table public.registration enable row level security;
alter table public.vehicle enable row level security;
alter table public.service enable row level security;
alter table public.payment enable row level security;
alter table public.video enable row level security;
alter table public.qr_code enable row level security;
alter table public.faq enable row level security;
alter table public.promotion enable row level security;
alter table public.recommendation enable row level security;

-- ============================================
-- HELPER: Check if current user is a host
-- ============================================
create or replace function public.is_host()
returns boolean as $$
begin
  return exists (
    select 1 from public.host
    where auth_user_id = auth.uid()
  );
end;
$$ language plpgsql security definer;

-- ============================================
-- HELPER: Get host ID for current user
-- ============================================
create or replace function public.current_host_id()
returns uuid as $$
begin
  return (
    select id from public.host
    where auth_user_id = auth.uid()
  );
end;
$$ language plpgsql security definer;

-- ============================================
-- HELPER: Get guest ID for current user
-- ============================================
create or replace function public.current_guest_id()
returns uuid as $$
begin
  return (
    select id from public.guest
    where auth_user_id = auth.uid()
  );
end;
$$ language plpgsql security definer;

-- ============================================
-- HOST policies
-- ============================================
create policy "Hosts can read own profile"
  on public.host for select
  using (auth_user_id = auth.uid());

create policy "Hosts can update own profile"
  on public.host for update
  using (auth_user_id = auth.uid());

-- ============================================
-- PROPERTY policies
-- ============================================
-- Public: anyone can read active properties
create policy "Anyone can read active properties"
  on public.property for select
  using (is_active = true);

-- Hosts can CRUD their own properties
create policy "Hosts can insert own properties"
  on public.property for insert
  with check (host_id = public.current_host_id());

create policy "Hosts can update own properties"
  on public.property for update
  using (host_id = public.current_host_id());

create policy "Hosts can delete own properties"
  on public.property for delete
  using (host_id = public.current_host_id());

-- ============================================
-- GUEST policies
-- ============================================
create policy "Guests can read own profile"
  on public.guest for select
  using (auth_user_id = auth.uid());

create policy "Guests can insert own profile"
  on public.guest for insert
  with check (auth_user_id = auth.uid());

create policy "Guests can update own profile"
  on public.guest for update
  using (auth_user_id = auth.uid());

-- Hosts can read guests who registered at their properties
create policy "Hosts can read their property guests"
  on public.guest for select
  using (
    public.is_host() and
    id in (
      select r.guest_id from public.registration r
      join public.property p on p.id = r.property_id
      where p.host_id = public.current_host_id()
    )
  );

-- ============================================
-- REGISTRATION policies
-- ============================================
create policy "Guests can read own registrations"
  on public.registration for select
  using (guest_id = public.current_guest_id());

create policy "Guests can insert own registrations"
  on public.registration for insert
  with check (guest_id = public.current_guest_id());

create policy "Guests can update own registrations"
  on public.registration for update
  using (guest_id = public.current_guest_id());

-- Hosts can read registrations for their properties
create policy "Hosts can read property registrations"
  on public.registration for select
  using (
    property_id in (
      select id from public.property
      where host_id = public.current_host_id()
    )
  );

-- ============================================
-- VEHICLE policies
-- ============================================
create policy "Guests can manage own vehicles"
  on public.vehicle for all
  using (
    registration_id in (
      select id from public.registration
      where guest_id = public.current_guest_id()
    )
  );

-- Hosts can read vehicles for their properties
create policy "Hosts can read property vehicles"
  on public.vehicle for select
  using (
    registration_id in (
      select r.id from public.registration r
      join public.property p on p.id = r.property_id
      where p.host_id = public.current_host_id()
    )
  );

-- ============================================
-- CONTENT policies (service, video, faq, promotion, recommendation)
-- Public read for active properties, host write for own properties
-- ============================================

-- SERVICES
create policy "Anyone can read active services"
  on public.service for select
  using (
    property_id in (select id from public.property where is_active = true)
  );

create policy "Hosts can manage own services"
  on public.service for all
  using (
    property_id in (
      select id from public.property
      where host_id = public.current_host_id()
    )
  );

-- VIDEOS
create policy "Anyone can read videos"
  on public.video for select
  using (
    property_id in (select id from public.property where is_active = true)
  );

create policy "Hosts can manage own videos"
  on public.video for all
  using (
    property_id in (
      select id from public.property
      where host_id = public.current_host_id()
    )
  );

-- FAQS
create policy "Anyone can read faqs"
  on public.faq for select
  using (
    property_id in (select id from public.property where is_active = true)
  );

create policy "Hosts can manage own faqs"
  on public.faq for all
  using (
    property_id in (
      select id from public.property
      where host_id = public.current_host_id()
    )
  );

-- PROMOTIONS
create policy "Anyone can read active promotions"
  on public.promotion for select
  using (
    is_active = true and
    property_id in (select id from public.property where is_active = true)
  );

create policy "Hosts can manage own promotions"
  on public.promotion for all
  using (
    property_id in (
      select id from public.property
      where host_id = public.current_host_id()
    )
  );

-- RECOMMENDATIONS
create policy "Anyone can read recommendations"
  on public.recommendation for select
  using (
    property_id in (select id from public.property where is_active = true)
  );

create policy "Hosts can manage own recommendations"
  on public.recommendation for all
  using (
    property_id in (
      select id from public.property
      where host_id = public.current_host_id()
    )
  );

-- ============================================
-- QR CODE policies
-- ============================================
create policy "Anyone can read active qr codes"
  on public.qr_code for select
  using (is_active = true);

create policy "Hosts can manage own qr codes"
  on public.qr_code for all
  using (
    property_id in (
      select id from public.property
      where host_id = public.current_host_id()
    )
  );

-- ============================================
-- PAYMENT policies
-- ============================================
create policy "Guests can read own payments"
  on public.payment for select
  using (guest_id = public.current_guest_id());

-- Hosts can read payments for their properties
create policy "Hosts can read property payments"
  on public.payment for select
  using (
    registration_id in (
      select r.id from public.registration r
      join public.property p on p.id = r.property_id
      where p.host_id = public.current_host_id()
    )
  );
