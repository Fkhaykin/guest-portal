-- ============================================
-- Cleaner Invoices
-- ============================================

create type public.invoice_status as enum ('draft', 'submitted', 'approved', 'paid');

create table public.cleaner_invoice (
  id uuid primary key default gen_random_uuid(),
  cleaner_id uuid not null references public.cleaner(id) on delete cascade,
  host_id uuid not null references public.host(id) on delete cascade,
  invoice_number text not null,
  status public.invoice_status not null default 'draft',

  -- Period covered
  period_start date not null,
  period_end date not null,

  -- Line items stored as JSONB array
  -- Each item: { description, type: "cleaning"|"pet_fee"|"extra", property_name?, registration_id?, amount }
  line_items jsonb not null default '[]',

  subtotal integer not null default 0,       -- cents
  total integer not null default 0,          -- cents
  notes text,

  submitted_at timestamptz,
  approved_at timestamptz,
  paid_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_cleaner_invoice_cleaner on public.cleaner_invoice(cleaner_id);
create index idx_cleaner_invoice_host on public.cleaner_invoice(host_id);
create index idx_cleaner_invoice_status on public.cleaner_invoice(status);

-- Generate invoice numbers: INV-YYYYMMDD-XXXX
create or replace function public.generate_invoice_number()
returns trigger as $$
declare
  seq int;
begin
  select count(*) + 1 into seq
  from public.cleaner_invoice
  where cleaner_id = NEW.cleaner_id;

  NEW.invoice_number := 'INV-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(seq::text, 4, '0');
  return NEW;
end;
$$ language plpgsql;

create trigger set_invoice_number
  before insert on public.cleaner_invoice
  for each row execute function public.generate_invoice_number();

create trigger set_updated_at before update on public.cleaner_invoice
  for each row execute function public.handle_updated_at();

-- ============================================
-- RLS POLICIES
-- ============================================
alter table public.cleaner_invoice enable row level security;

-- Hosts can view invoices addressed to them
create policy "Hosts can view their invoices"
  on public.cleaner_invoice for select
  using (host_id = public.current_host_id());

-- Hosts can update invoice status (approve/pay)
create policy "Hosts can update invoice status"
  on public.cleaner_invoice for update
  using (host_id = public.current_host_id());
