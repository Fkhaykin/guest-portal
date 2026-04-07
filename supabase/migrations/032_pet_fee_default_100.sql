-- Update pet fee default to $100 (was $0)
alter table public.property alter column pet_fee_cents set default 10000;

-- Update existing properties that still have the old default of 0
update public.property set pet_fee_cents = 10000 where pet_fee_cents = 0;
