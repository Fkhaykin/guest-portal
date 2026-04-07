-- Hold pets that require a fee until payment is confirmed
alter table registration add column if not exists pending_pets jsonb;
