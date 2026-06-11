-- Guest marketing: segments, campaigns (manual + drip), per-host send cap.

-- Host-wide marketing send cap (configurable per-host)
alter table host
  add column if not exists marketing_send_cap_days int not null default 14,
  add column if not exists marketing_from_email text,
  add column if not exists marketing_from_name text;

-- Segments: stored filter rules, evaluated live against registration+guest.
create table guest_segment (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references host(id) on delete cascade,
  name text not null,
  description text,
  filter jsonb not null default '{}'::jsonb,
  -- filter shape: {
  --   stayed_from: 'YYYY-MM-DD' | null,   -- check_out_date >= this
  --   stayed_until: 'YYYY-MM-DD' | null,  -- check_out_date <= this
  --   property_ids: uuid[] | null,        -- null/empty = all properties
  --   min_stays: int | null,              -- inclusive
  --   max_stays: int | null               -- inclusive
  -- }
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_guest_segment_host on guest_segment(host_id);

create trigger set_guest_segment_updated_at
  before update on guest_segment
  for each row execute function handle_updated_at();

-- Campaigns
create table marketing_campaign (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references host(id) on delete cascade,
  segment_id uuid references guest_segment(id) on delete restrict,
  name text not null,
  kind text not null check (kind in ('manual', 'drip')),
  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused', 'sent', 'archived')),
  default_channel text not null default 'auto'
    check (default_channel in ('auto', 'email', 'sms')),
  -- Optional per-campaign send cap override (NULL = use host default)
  send_cap_days int,
  -- Token values
  discount_code text,
  direct_book_url text,
  -- Manual-only: when 'send now' was clicked
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_marketing_campaign_host on marketing_campaign(host_id);
create index idx_marketing_campaign_status on marketing_campaign(status);
create index idx_marketing_campaign_segment on marketing_campaign(segment_id);

create trigger set_marketing_campaign_updated_at
  before update on marketing_campaign
  for each row execute function handle_updated_at();

-- Steps: 1+ per campaign. Manual = exactly 1 step with delay_days_after_checkout = NULL.
create table marketing_campaign_step (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references marketing_campaign(id) on delete cascade,
  step_order int not null default 1,
  -- Drip: days after check_out_date to fire (e.g. 7, 30, 90). NULL = manual (fire immediately on send).
  delay_days_after_checkout int,
  subject text,        -- email subject (nullable when channel resolves to SMS only)
  html_body text,      -- rich HTML for email
  text_body text,      -- plain text for SMS, also fallback for email
  channel_override text check (channel_override in ('auto', 'email', 'sms')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, step_order)
);

create index idx_marketing_campaign_step_campaign on marketing_campaign_step(campaign_id);

create trigger set_marketing_campaign_step_updated_at
  before update on marketing_campaign_step
  for each row execute function handle_updated_at();

-- Send log: one row per (campaign, step, guest). Drives dedupe + analytics.
create table marketing_campaign_send (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references marketing_campaign(id) on delete cascade,
  step_id uuid not null references marketing_campaign_step(id) on delete cascade,
  guest_id uuid not null references guest(id) on delete cascade,
  registration_id uuid references registration(id) on delete set null,
  channel text not null check (channel in ('email', 'sms')),
  status text not null check (status in ('pending', 'sent', 'failed', 'skipped_capped')),
  recipient text not null,        -- email address or phone number actually used
  subject text,
  body text not null,             -- rendered final text/html
  sent_at timestamptz,
  error text,
  provider_message_id text,
  created_at timestamptz not null default now()
);

create unique index marketing_campaign_send_dedup
  on marketing_campaign_send (campaign_id, step_id, guest_id);
create index idx_marketing_campaign_send_guest on marketing_campaign_send(guest_id, sent_at desc);
create index idx_marketing_campaign_send_campaign on marketing_campaign_send(campaign_id, sent_at desc);

-- RLS: hosts only see their own segments/campaigns/sends.
alter table guest_segment enable row level security;
alter table marketing_campaign enable row level security;
alter table marketing_campaign_step enable row level security;
alter table marketing_campaign_send enable row level security;

create policy "Hosts manage own segments"
  on guest_segment for all
  using (host_id = current_host_id())
  with check (host_id = current_host_id());

create policy "Hosts manage own campaigns"
  on marketing_campaign for all
  using (host_id = current_host_id())
  with check (host_id = current_host_id());

create policy "Hosts manage own campaign steps"
  on marketing_campaign_step for all
  using (
    exists (
      select 1 from marketing_campaign c
      where c.id = marketing_campaign_step.campaign_id
        and c.host_id = current_host_id()
    )
  )
  with check (
    exists (
      select 1 from marketing_campaign c
      where c.id = marketing_campaign_step.campaign_id
        and c.host_id = current_host_id()
    )
  );

create policy "Hosts read own campaign sends"
  on marketing_campaign_send for select
  using (
    exists (
      select 1 from marketing_campaign c
      where c.id = marketing_campaign_send.campaign_id
        and c.host_id = current_host_id()
    )
  );

-- Service role inserts sends from API routes / cron
create policy "Service role inserts campaign sends"
  on marketing_campaign_send for insert
  with check (true);
