-- Record when the sentiment gate auto-skips the post-checkout review request,
-- so the reservation detail page can show the admin that the system detected
-- problems and withheld the review ask (previously this only hit cron logs).
-- The gate runs once, the morning after check-out, so a recorded skip is final.

alter table registration
  add column review_request_skipped_at timestamptz,
  add column review_request_skip_reason text;
