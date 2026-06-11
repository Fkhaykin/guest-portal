-- Web push subscriptions for cleaner portal PWA notifications
create table public.push_subscription (
  id uuid primary key default gen_random_uuid(),
  cleaner_id uuid not null references public.cleaner(id) on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index idx_push_subscription_cleaner on public.push_subscription(cleaner_id);

-- Admin client only (same model as cleaner_session): RLS on, no policies
alter table public.push_subscription enable row level security;
