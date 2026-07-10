-- Manual "force on" override for the post-checkout review request.
--
-- review_request_disabled is the manual "force off". This is its mirror: when
-- an admin flips the toggle back on for a guest the sentiment gate auto-skipped,
-- the request should send anyway AND stay sent — a later angry message must not
-- silently re-flag and undo the admin's decision. Precedence:
--   disabled → off ; forced → on ; auto-skip flag → off ; else → on.
-- Both manual states are sticky; only the untouched/auto state self-corrects.

alter table registration
  add column review_request_forced boolean not null default false;
