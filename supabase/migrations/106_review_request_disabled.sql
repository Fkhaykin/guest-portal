-- Per-reservation kill switch for the post-checkout review request.
--
-- The sentiment gate (shouldRequestReview) auto-skips guests whose messages
-- show a bad stay, but the host often knows about a problem the thread never
-- mentions (in-person complaint, phone call, refund via the OTA). This flag
-- lets the admin turn the review ask off for a specific booking from the
-- reservation detail page; the morning cron skips post_checkout when set.

alter table registration
  add column review_request_disabled boolean not null default false;
