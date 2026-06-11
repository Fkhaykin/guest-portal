-- Allow hosts (admin panel) to register push subscriptions alongside cleaners
alter table public.push_subscription alter column cleaner_id drop not null;

alter table public.push_subscription
  add column host_id uuid references public.host(id) on delete cascade;

alter table public.push_subscription
  add constraint push_subscription_owner_check
  check (num_nonnulls(cleaner_id, host_id) = 1);

create index idx_push_subscription_host on public.push_subscription(host_id);
