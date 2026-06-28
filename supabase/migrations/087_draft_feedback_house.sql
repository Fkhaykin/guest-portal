-- House-scoped AI draft rules.
-- Until now every rule from the "Fix" flow applied globally. The messenger now
-- offers "Add house rule" vs "Add global rule": a house rule is scoped to one
-- home's future drafts, a global rule applies everywhere.
--   house IS NULL  -> global (applies to every home; existing rows stay global)
--   house = <key>  -> only injected into drafts for that home
-- Houses are keyed by nickname (lakehouse/chalet/manor/cottage/mansion), not
-- property_id, so a rule covers both Airbnb listings of a duplicated home.
alter table draft_feedback add column if not exists house text;

alter table draft_feedback drop constraint if exists draft_feedback_house_check;
alter table draft_feedback add constraint draft_feedback_house_check
  check (house is null or house in ('lakehouse', 'chalet', 'manor', 'cottage', 'mansion'));

create index if not exists draft_feedback_house_idx on draft_feedback (house);

comment on column draft_feedback.house is
  'House key the rule is scoped to; NULL = global (applies to all homes).';
