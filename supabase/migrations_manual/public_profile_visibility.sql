-- Run this once in the Supabase SQL Editor.
--
-- Unifies "who can see someone's content" across workouts and profile stats: a viewer can see
-- another user's workouts/exercises/sets/stats/weigh-ins if that user has an accepted follower
-- relationship with them, OR if the target's profile is public (profiles.is_public = true) —
-- previously `is_public` only gated profile_stats/body_weight_logs and the follow system only
-- gated workouts/exercises/sets, so a public-profile user's workouts were still invisible to
-- non-followers and an accepted follower couldn't see their friend's height/weight.

-- 1. workouts/exercises/sets: add the "target profile is public" OR-branch alongside the existing
--    owner/accepted-follower check.
do $$
declare
  pol record;
begin
  for pol in select policyname from pg_policies where tablename = 'workouts' and cmd = 'SELECT'
  loop
    execute format('drop policy %I on workouts', pol.policyname);
  end loop;
end $$;

create policy "workouts visible to owner, accepted followers, or public profiles" on workouts
  for select using (
    auth.uid() = user_id
    or exists (
      select 1 from follows
      where follows.follower_id = auth.uid()
        and follows.following_id = workouts.user_id
        and follows.status = 'accepted'
    )
    or exists (
      select 1 from profiles
      where profiles.id = workouts.user_id and profiles.is_public = true
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

create policy "exercises visible to owner, accepted followers, or public profiles" on exercises
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
          or exists (
            select 1 from profiles
            where profiles.id = workouts.user_id and profiles.is_public = true
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

create policy "sets visible to owner, accepted followers, or public profiles" on sets
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
          or exists (
            select 1 from profiles
            where profiles.id = workouts.user_id and profiles.is_public = true
          )
        )
    )
  );

-- 2. profile_stats/body_weight_logs: add the "accepted follower" OR-branch alongside the existing
--    owner/public-profile check.
do $$
declare
  pol record;
begin
  for pol in select policyname from pg_policies where tablename = 'profile_stats' and cmd = 'SELECT'
  loop
    execute format('drop policy %I on profile_stats', pol.policyname);
  end loop;
end $$;

create policy "profile_stats read own, public, or accepted followers" on profile_stats
  for select using (
    auth.uid() = user_id
    or exists (select 1 from profiles p where p.id = profile_stats.user_id and p.is_public = true)
    or exists (
      select 1 from follows
      where follows.follower_id = auth.uid()
        and follows.following_id = profile_stats.user_id
        and follows.status = 'accepted'
    )
  );

do $$
declare
  pol record;
begin
  for pol in select policyname from pg_policies where tablename = 'body_weight_logs' and cmd = 'SELECT'
  loop
    execute format('drop policy %I on body_weight_logs', pol.policyname);
  end loop;
end $$;

create policy "body_weight_logs read own, public, or accepted followers" on body_weight_logs
  for select using (
    auth.uid() = user_id
    or exists (select 1 from profiles p where p.id = body_weight_logs.user_id and p.is_public = true)
    or exists (
      select 1 from follows
      where follows.follower_id = auth.uid()
        and follows.following_id = body_weight_logs.user_id
        and follows.status = 'accepted'
    )
  );
