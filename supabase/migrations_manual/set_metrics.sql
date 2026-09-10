-- Generalises a "set" so it can measure something other than reps × load, which is what every
-- non-strength activity needs: a plank and a boxing round are seconds, a run is metres.
--
-- Deliberately additive. `reps` and `weight` stay NOT NULL (now defaulting to 0) rather than
-- becoming nullable: making them nullable would force edits at 50+ call sites on the strength
-- path — including Live mode — purely to satisfy the type checker, with real regression risk and
-- no behavioural gain. The authority on how to read a set is `exercises.metric`, not which column
-- happens to be null; for a duration exercise the reps/weight zeros are never read.
alter table exercises add column if not exists metric text not null default 'reps'
  check (metric in ('reps', 'duration', 'distance'));

alter table sets add column if not exists duration_seconds integer check (duration_seconds >= 0);
alter table sets add column if not exists distance_m numeric check (distance_m >= 0);

alter table sets alter column reps set default 0;
alter table sets alter column weight set default 0;

comment on column exercises.metric is
  'How this exercise''s sets are measured: reps (reps + weight), duration (duration_seconds), distance (distance_m + duration_seconds).';
