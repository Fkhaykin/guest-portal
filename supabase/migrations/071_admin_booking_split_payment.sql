-- Admin-created bookings with optional 50/50 split-payment plan.
-- Deposit (or full payment) is collected via a Stripe Invoice link emailed to the guest.
-- For split plans, the saved payment method is auto-charged 30 days before check-in;
-- after 3 failed attempts the booking is cancelled.

alter table public.registration
  add column if not exists payment_plan text not null default 'full',
  add column if not exists deposit_paid_at timestamptz,
  add column if not exists balance_paid_at timestamptz,
  add column if not exists balance_charge_attempts int not null default 0,
  add column if not exists balance_last_attempt_at timestamptz,
  add column if not exists balance_last_failure_reason text,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_payment_method_id text,
  add column if not exists stripe_deposit_invoice_id text,
  add column if not exists stripe_balance_invoice_id text;

alter table public.registration drop constraint if exists registration_payment_plan_check;
alter table public.registration
  add constraint registration_payment_plan_check
  check (payment_plan in ('full', 'split'));

create index if not exists registration_balance_due_idx
  on public.registration (check_in_date)
  where payment_plan = 'split' and balance_paid_at is null and status = 'active';

create index if not exists registration_stripe_deposit_invoice_idx
  on public.registration (stripe_deposit_invoice_id)
  where stripe_deposit_invoice_id is not null;

create index if not exists registration_stripe_balance_invoice_idx
  on public.registration (stripe_balance_invoice_id)
  where stripe_balance_invoice_id is not null;
