-- Full price breakdown snapshot from the Lodgify v2 booking detail, for
-- channel (Airbnb/VRBO/manual-Lodgify) bookings. Direct/admin bookings keep
-- using the structured columns (nightly_rates_snapshot, cleaning_fee_cents, …).
--
-- Shape (all money fields are integer cents):
-- {
--   currency: "USD",
--   total: 171566,            -- gross guest total (stay + fees + taxes)
--   stay: 129900, fees: 27500, taxes: 14166, addons: 0, promotions: 0,
--   amount_paid: 0, amount_due: 171566,
--   host_fee: 24397,          -- OTA service fee (Airbnb only), null elsewhere
--   payout: 133003,           -- expected host payout (Airbnb only)
--   items: [{ type: "RoomRate"|"Fee"|"Tax"|..., amount: 129900, description: "Daily price" }]
-- }
alter table registration add column if not exists lodgify_price_breakdown jsonb;

comment on column registration.lodgify_price_breakdown is
  'Itemized price snapshot from Lodgify v2 booking detail (channel bookings); cents. See migration 107.';
