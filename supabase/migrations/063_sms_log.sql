create table sms_log (
  id uuid primary key default gen_random_uuid(),
  sent_at timestamptz not null default now(),
  recipient_phone text not null,
  recipient_name text,
  message text not null,
  event_type text not null,
  lodgify_booking_id integer,
  property_id uuid references property(id) on delete set null,
  success boolean not null,
  error text,
  quota_remaining integer
);

create index sms_log_sent_at_idx on sms_log(sent_at desc);
create index sms_log_property_id_idx on sms_log(property_id);

alter table sms_log enable row level security;

create policy "Hosts can read sms logs for their properties"
  on sms_log for select
  using (
    property_id is null or
    exists (
      select 1 from property p
      where p.id = sms_log.property_id
        and p.host_id = current_host_id()
    )
  );

create policy "Service role can insert sms logs"
  on sms_log for insert
  with check (true);
