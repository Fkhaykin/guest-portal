-- Audit log + notes for the Pricing Lab right rail (PriceLabs parity: Base
-- Price History, Action Logs, Notes).

-- Every config change (anchors, mode, rules) is appended here on save, so the
-- rail can show Base Price History and a general Action Log.
create table if not exists pricing_config_log (
  id bigint generated always as identity primary key,
  nickname text not null,
  field text not null,            -- 'base_price_cents' | 'min_price_cents' | 'max_price_cents' | 'mode' | 'rules'
  old_value text,
  new_value text,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_pricing_config_log on pricing_config_log (nickname, created_at desc);

-- Free-text notes per house (e.g. "raised base for ski season").
create table if not exists pricing_note (
  id uuid primary key default gen_random_uuid(),
  nickname text not null,
  body text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_pricing_note on pricing_note (nickname, created_at desc);

alter table pricing_config_log enable row level security;
alter table pricing_note enable row level security;
create policy "Hosts view pricing config log" on pricing_config_log for select using (is_host());
create policy "Hosts view pricing notes" on pricing_note for select using (is_host());
