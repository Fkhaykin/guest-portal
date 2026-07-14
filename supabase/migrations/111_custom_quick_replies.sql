-- Host-authored quick replies for the admin messenger, created on the fly
-- from the composer. Scope: house = one home's conversations only; house null
-- = offered account-wide. Complements the built-in library in
-- src/lib/guest-messages/quick-replies.ts (which stays in code).

create table custom_quick_reply (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  category text not null default 'My Replies',
  house text check (house in ('lakehouse', 'chalet', 'manor', 'cottage', 'mansion')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.custom_quick_reply
  for each row execute function public.handle_updated_at();

-- Accessed only through /api/admin/quick-replies with the service role;
-- locked to everyone else.
alter table custom_quick_reply enable row level security;
