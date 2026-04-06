-- Store purchased upsells on registration
alter table public.registration
  add column upsells jsonb default '[]'::jsonb;

-- Track upsell payments separately
-- upsells jsonb format: [{type, label, price_cents, stripe_session_id, status, meta}]
