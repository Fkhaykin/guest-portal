-- Admin booking enhancements:
--   1. discount_label: human-readable name for an admin-applied discount
--      (e.g. "Loyalty Discount"). Shown in the breakdown, on the Stripe
--      invoice line, and in the guest email.
--   2. payment_plan 'automatic': defer the invoice. The guest gets a link
--      to pick Full vs. Split themselves; Split is offered only when the
--      check-in is >= 60 days out.

alter table public.registration
  add column if not exists discount_label text;

alter table public.registration drop constraint if exists registration_payment_plan_check;
alter table public.registration
  add constraint registration_payment_plan_check
  check (payment_plan in ('full', 'split', 'automatic'));
