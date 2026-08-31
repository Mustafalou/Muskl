-- Run this once in the Supabase SQL Editor.

-- 1. New table: one row per follow relationship, asymmetric (A following B is independent from
--    B following A), gated by an accept step.
create table if not exists follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  unique (follower_id, following_id),
  check (follower_id <> following_id)
);

grant select, insert, update, delete on follows to authenticated;

alter table follows enable row level security;

drop policy if exists "select own follow relationships" on follows;
create policy "select own follow relationships" on follows
  for select using (auth.uid() = follower_id or auth.uid() = following_id);

drop policy if exists "insert own follow request" on follows;
create policy "insert own follow request" on follows
  for insert with check (auth.uid() = follower_id);

drop policy if exists "delete own follow relationships" on follows;
create policy "delete own follow relationships" on follows
  for delete using (auth.uid() = follower_id or auth.uid() = following_id);

drop policy if exists "target can accept follow request" on follows;
create policy "target can accept follow request" on follows
  for update using (auth.uid() = following_id) with check (auth.uid() = following_id);

-- 2. Lock down `workouts`/`exercises`/`sets` so they're only visible to their owner or to viewers
--    with an accepted follow relationship — replaces whatever public-read SELECT policy existed
--    before (dropped by name below, whatever it was called).
do $$
declare
  pol record;
begin
  for pol in select policyname from pg_policies where tablename = 'workouts' and cmd = 'SELECT'
  loop
    execute format('drop policy %I on workouts', pol.policyname);
  end loop;
end $$;

create policy "workouts visible to owner or accepted followers" on workouts
  for select using (
    auth.uid() = user_id
    or exists (
      select 1 from follows
      where follows.follower_id = auth.uid()
        and follows.following_id = workouts.user_id
        and follows.status = 'accepted'
    )
  );

do $$
declare
  pol record;
begin
  for pol in select policyname from pg_policies where tablename = 'exercises' and cmd = 'SELECT'
  loop
    execute format('drop policy %I on exercises', pol.policyname);
  end loop;
end $$;

create policy "exercises visible to owner or accepted followers" on exercises
  for select using (
    exists (
      select 1 from workouts
      where workouts.id = exercises.workout_id
        and (
          workouts.user_id = auth.uid()
          or exists (
            select 1 from follows
            where follows.follower_id = auth.uid()
              and follows.following_id = workouts.user_id
              and follows.status = 'accepted'
          )
        )
    )
  );

do $$
declare
  pol record;
begin
  for pol in select policyname from pg_policies where tablename = 'sets' and cmd = 'SELECT'
  loop
    execute format('drop policy %I on sets', pol.policyname);
  end loop;
end $$;

create policy "sets visible to owner or accepted followers" on sets
  for select using (
    exists (
      select 1
      from exercises
      join workouts on workouts.id = exercises.workout_id
      where exercises.id = sets.exercise_id
        and (
          workouts.user_id = auth.uid()
          or exists (
            select 1 from follows
            where follows.follower_id = auth.uid()
              and follows.following_id = workouts.user_id
              and follows.status = 'accepted'
          )
        )
    )
  );

-- `profiles` stays publicly readable on purpose — usernames must remain searchable so people can
-- find someone to send a follow request to in the first place.
