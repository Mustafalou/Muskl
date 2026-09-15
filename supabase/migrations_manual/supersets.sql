-- Supersets: consecutive exercises sharing a superset_id are done back to back (one set of each,
-- then rest). Each exercise keeps its own sets, so per-lift history and 1RM stay accurate.
-- Null means "not part of a superset". No foreign key: the id only names a group.
alter table exercises add column if not exists superset_id uuid;
alter table template_exercises add column if not exists superset_id uuid;

select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public' and column_name = 'superset_id'
order by table_name;
