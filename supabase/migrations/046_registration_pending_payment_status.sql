-- Allow 'pending_payment' status for direct booking checkout flow
alter table public.registration drop constraint if exists registration_status_check;
alter table public.registration
  add constraint registration_status_check
  check (status in ('active', 'completed', 'cancelled', 'pending_payment'));
