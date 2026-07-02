-- Owner/host manual calendar blocks (maintenance, owner stays, off-market).
--
-- Replaces blocking dates directly in Lodgify: hosts now block from our own
-- dashboard. A block occupies the NIGHTS of [start_date, check_out) — same
-- convention as a booking, so start_date is the first blocked night and
-- end_date is the checkout day (the morning the block ends, never itself
-- blocked). Blocks are grouped with bookings by property nickname when the
-- availability calendar is built, so a block on either duplicate listing of a
-- physical house blocks the whole house.
--
-- To also keep OTA channels (Airbnb/VRBO) from booking a blocked window, a
-- block is optionally pushed to Lodgify as a held "Booked" reservation (the
-- same mechanism direct bookings use — Lodgify has no date-block API). The
-- resulting Lodgify id is stored so the hold can be released when the block is
-- deleted.
create table if not exists property_block (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references property(id) on delete cascade,
  start_date date not null,          -- first blocked night
  end_date date not null,            -- checkout day (exclusive; last night = end_date - 1)
  reason text,
  lodgify_booking_id bigint,         -- set when the block is pushed to Lodgify to hold OTA calendars
  lodgify_sync_status text,          -- 'synced' | 'failed' | null (not pushed)
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_block_dates_check check (end_date > start_date)
);

create index if not exists idx_property_block_property on property_block(property_id);
create index if not exists idx_property_block_dates on property_block(property_id, start_date, end_date);

create trigger set_property_block_updated_at
  before update on property_block
  for each row execute function handle_updated_at();

alter table property_block enable row level security;

-- Hosts manage blocks for their own properties. Admin API routes use the
-- service role and bypass RLS; these policies are the backstop for any
-- anon/authed access.
create policy "Hosts view own property blocks"
  on property_block for select
  using (
    exists (
      select 1 from property p
      where p.id = property_block.property_id and p.host_id = current_host_id()
    )
  );

create policy "Hosts insert own property blocks"
  on property_block for insert
  with check (
    exists (
      select 1 from property p
      where p.id = property_block.property_id and p.host_id = current_host_id()
    )
  );

create policy "Hosts update own property blocks"
  on property_block for update
  using (
    exists (
      select 1 from property p
      where p.id = property_block.property_id and p.host_id = current_host_id()
    )
  );

create policy "Hosts delete own property blocks"
  on property_block for delete
  using (
    exists (
      select 1 from property p
      where p.id = property_block.property_id and p.host_id = current_host_id()
    )
  );
