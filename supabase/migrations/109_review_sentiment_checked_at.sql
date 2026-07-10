-- Throttle marker for message-triggered review-sentiment evaluations.
--
-- The sentiment gate now re-runs whenever a new inbound guest message arrives
-- (Lodgify webhook, web chat, direct email/SMS) so a planned review-request
-- skip shows on the reservation page mid-stay. Lodgify burst-delivers webhooks
-- 2-3x, so callers claim this timestamp with a conditional UPDATE — of N
-- concurrent claimers exactly one wins and runs the LLM evaluation.

alter table registration
  add column review_sentiment_checked_at timestamptz;
