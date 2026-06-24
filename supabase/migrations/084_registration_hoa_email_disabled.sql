-- Per-reservation switch to suppress automatic HOA/PEPOA submission emails.
-- When true, the auto-sends triggered by guest register / update / Lodgify date
-- sync are skipped. The manual "Email to HOA" admin action still sends as an
-- explicit override.
alter table registration
  add column if not exists hoa_email_disabled boolean not null default false;

comment on column registration.hoa_email_disabled is
  'When true, automatic HOA/PEPOA submission emails are suppressed for this reservation. The manual "Email to HOA" admin action overrides this.';
