-- Maintenance punch list per property: issues reported by guests or spotted
-- by cleaners that need a repair visit, distinct from per-turnover cleaning
-- (cleaning_status) and from chargeable damage claims (aircover_claim).
-- Surfaced in the cleaner portal's Tasks page; cleaners check items off as
-- they fix them.
create table if not exists maintenance_task (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references property(id) on delete cascade,
  -- Booking whose guest surfaced the issue, when there is one.
  registration_id uuid references registration(id) on delete set null,
  description text not null,
  -- Human-readable origin, e.g. 'Guest report — Dennis G., stay Jul 24-31'.
  source text,
  status text not null default 'open' check (status in ('open', 'done')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  completed_by uuid references cleaner(id) on delete set null,
  completion_note text
);

create index if not exists maintenance_task_property_open_idx
  on maintenance_task (property_id) where status = 'open';

-- Service-role access only (cleaner/admin API routes).
alter table maintenance_task enable row level security;
