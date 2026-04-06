-- Function to bulk update total_amount_cents on registrations.
-- Accepts parallel arrays of lodgify_booking_ids and amounts.
CREATE OR REPLACE FUNCTION update_registration_amounts(
  booking_ids bigint[],
  amounts integer[]
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE registration r
  SET total_amount_cents = data.amount
  FROM unnest(booking_ids, amounts) AS data(booking_id, amount)
  WHERE r.lodgify_booking_id = data.booking_id;
END;
$$;
