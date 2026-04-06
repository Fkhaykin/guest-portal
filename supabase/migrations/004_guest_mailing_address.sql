-- Add mailing address to guest table for registration
alter table public.guest
  add column mailing_address text;
