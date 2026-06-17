-- Promotion discounts: let hosts specify the actual offer instead of just
-- marketing copy. A promotion can give a percentage off, a flat dollar amount
-- off, a free cleaning fee, a free pet fee, or any combination of these.
alter table promotion
  add column if not exists discount_percent int,
  add column if not exists discount_amount int,        -- whole dollars off
  add column if not exists free_cleaning boolean not null default false,
  add column if not exists free_pet_fee boolean not null default false;
