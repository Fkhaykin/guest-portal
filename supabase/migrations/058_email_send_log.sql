create table email_send_log (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references registration(id) on delete cascade,
  sent_to text[] not null,
  subject text,
  body_summary text,
  email_type text not null default 'pepoa',
  is_update boolean not null default false,
  created_at timestamptz not null default now()
);

create index email_send_log_registration_id_idx on email_send_log(registration_id);

alter table email_send_log enable row level security;

create policy "Hosts can read email logs for their registrations"
  on email_send_log for select
  using (
    exists (
      select 1 from registration r
      join property p on p.id = r.property_id
      where r.id = email_send_log.registration_id
        and p.host_id = current_host_id()
    )
  );
