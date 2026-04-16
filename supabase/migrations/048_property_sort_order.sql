-- Add sort_order to property for admin drag-and-drop reordering
alter table public.property add column sort_order integer not null default 0;

-- Backfill existing properties with sequential order based on created_at
with numbered as (
  select id, row_number() over (partition by host_id order by created_at) - 1 as rn
  from public.property
)
update public.property p
set sort_order = n.rn
from numbered n
where p.id = n.id;
