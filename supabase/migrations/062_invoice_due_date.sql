alter table public.cleaner_invoice
  add column if not exists due_date date;
