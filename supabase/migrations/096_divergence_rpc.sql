-- Divergence history for the PriceLabs-check tab, aggregated in SQL so it
-- isn't capped by PostgREST's 1000-row ceiling (the JS version silently froze
-- on week-one data once rate_snapshot grew past ~3 days × 365 rows/house).
-- Mean absolute gap between our price and PriceLabs' pushed price over the next
-- 90 stay dates, per snapshot day, matching the headline stat's open-night sample.
create or replace function divergence_history(p_nickname text)
returns table (snapshot_date date, mean_abs_pct numeric, dates_compared integer)
language sql
stable
as $$
  select
    s.snapshot_date,
    round(avg(abs(s.our_price_cents - s.pl_user_price_cents)::numeric / s.pl_user_price_cents) * 1000) / 10
      as mean_abs_pct,
    count(*)::int as dates_compared
  from rate_snapshot s
  where lower(s.nickname) = lower(p_nickname)
    and s.pl_user_price_cents is not null and s.pl_user_price_cents > 0
    and s.our_price_cents is not null
    and s.is_booked = false
    and s.stay_date >= s.snapshot_date
    and s.stay_date <= s.snapshot_date + 90
  group by s.snapshot_date
  order by s.snapshot_date desc
  limit 60;
$$;

grant execute on function divergence_history(text) to authenticated, service_role;
