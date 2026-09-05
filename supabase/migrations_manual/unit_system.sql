-- Display preference for weights and height. Values stay in kilograms and centimetres in every
-- table: converting on write would make existing rows ambiguous and any future export unreadable.
-- This column only says how to render and how to interpret what the user types.
alter table profile_stats add column if not exists unit_system text
  check (unit_system in ('metric', 'imperial'));
