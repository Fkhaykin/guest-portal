-- Free-nights promo codes can now be limited to weeknights only.
-- 'any'       = the X cheapest nights of the stay are free
-- 'weeknight' = only weeknights (Sun–Thu) are eligible; the X cheapest of those are free
alter table public.promo_code
  add column if not exists free_nights_scope text not null default 'any'
    check (free_nights_scope in ('any', 'weeknight'));
