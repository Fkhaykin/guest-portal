-- Per-reservation admin overrides for the timing upsells (early check-in /
-- late check-out). NULL = automatic (cross-property turnaround rules apply).
-- 'allow' = always purchasable regardless of turnarounds, up to *_override_hours
-- extra hours (falls back to the standard 2 when NULL). 'block' = never
-- purchasable for this stay (no request-only fallback either). The guest still
-- pays the normal hourly rate — overrides affect availability only.

ALTER TABLE registration
  ADD COLUMN early_checkin_override text
    CHECK (early_checkin_override IN ('allow', 'block')),
  ADD COLUMN early_checkin_override_hours smallint
    CHECK (early_checkin_override_hours BETWEEN 1 AND 12),
  ADD COLUMN late_checkout_override text
    CHECK (late_checkout_override IN ('allow', 'block')),
  ADD COLUMN late_checkout_override_hours smallint
    CHECK (late_checkout_override_hours BETWEEN 1 AND 12);
