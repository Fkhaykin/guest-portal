-- Store Lodgify guest breakdown (adults, children, infants) on registration
ALTER TABLE registration
  ADD COLUMN lodgify_adults   integer DEFAULT 0,
  ADD COLUMN lodgify_children integer DEFAULT 0,
  ADD COLUMN lodgify_infants  integer DEFAULT 0;
