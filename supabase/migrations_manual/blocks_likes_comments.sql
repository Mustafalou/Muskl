-- Blocking (required by App Store guideline 1.2 for any app showing user-generated content),
-- plus likes and comments on workouts.

-- ---------------------------------------------------------------------------
-- 1. Blocks
-- ---------------------------------------------------------------------------
create table if not exists blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

grant select, insert, delete on blocks to authenticated;
alter table blocks enable row level security;

-- Deliberately readable by the blocker only: the blocked person is never told, which is the point.
drop policy if exists "read own blocks" on blocks;
create policy "read own blocks" on blocks
  for select using (auth.uid() = blocker_id);

drop policy if exists "create own blocks" on blocks;
create policy "create own blocks" on blocks
  for insert with check (auth.uid() = blocker_id);

drop policy if exists "delete own blocks" on blocks;
create policy "delete own blocks" on blocks
  for delete using (auth.uid() = blocker_id);

-- Helper so the content policies below stay readable. SECURITY DEFINER because a viewer must be
-- able to test "did THEY block ME", which the select policy above intentionally hides from them.
create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from blocks
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  );
$$;

revoke all on function public.is_blocked_between(uuid, uuid) from public;
grant execute on function public.is_blocked_between(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Content visibility now also requires the absence of a block, in either direction
-- ---------------------------------------------------------------------------
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where tablename = 'workouts' and cmd = 'SELECT'
  loop execute format('drop policy %I on workouts', pol.policyname); end loop;
end $$;

create policy "workouts visible to owner, accepted followers, or public profiles" on workouts
  for select using (
    auth.uid() = user_id
    or (
      not public.is_blocked_between(auth.uid(), workouts.user_id)
      and (
        exists (
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

-- exercises/sets inherit visibility through `workouts`, whose policy now carries the block check.
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where tablename = 'exercises' and cmd = 'SELECT'
  loop execute format('drop policy %I on exercises', pol.policyname); end loop;
end $$;

create policy "exercises follow workout visibility" on exercises
  for select using (
    exists (select 1 from workouts where workouts.id = exercises.workout_id)
  );

do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where tablename = 'sets' and cmd = 'SELECT'
  loop execute format('drop policy %I on sets', pol.policyname); end loop;
end $$;

create policy "sets follow exercise visibility" on sets
  for select using (
    exists (select 1 from exercises where exercises.id = sets.exercise_id)
  );

-- A block also prevents new follow requests in either direction.
drop policy if exists "insert own follow request" on follows;
create policy "insert own follow request" on follows
  for insert with check (
    auth.uid() = follower_id
    and not public.is_blocked_between(auth.uid(), following_id)
  );

-- ---------------------------------------------------------------------------
-- 3. Likes
-- ---------------------------------------------------------------------------
create table if not exists workout_likes (
  workout_id uuid not null references workouts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (workout_id, user_id)
);

grant select, insert, delete on workout_likes to authenticated;
alter table workout_likes enable row level security;

-- No explicit visibility rule needed: the subquery on `workouts` is itself filtered by that
-- table's policy, so a like is readable exactly when its workout is.
drop policy if exists "likes follow workout visibility" on workout_likes;
create policy "likes follow workout visibility" on workout_likes
  for select using (
    exists (select 1 from workouts where workouts.id = workout_likes.workout_id)
  );

drop policy if exists "like a visible workout" on workout_likes;
create policy "like a visible workout" on workout_likes
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from workouts where workouts.id = workout_likes.workout_id)
  );

drop policy if exists "remove own like" on workout_likes;
create policy "remove own like" on workout_likes
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 4. Comments
-- ---------------------------------------------------------------------------
create table if not exists workout_comments (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references workouts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists workout_comments_workout_id_idx on workout_comments (workout_id, created_at);

grant select, insert, delete on workout_comments to authenticated;
alter table workout_comments enable row level security;

drop policy if exists "comments follow workout visibility" on workout_comments;
create policy "comments follow workout visibility" on workout_comments
  for select using (
    exists (select 1 from workouts where workouts.id = workout_comments.workout_id)
  );

drop policy if exists "comment on a visible workout" on workout_comments;
create policy "comment on a visible workout" on workout_comments
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from workouts where workouts.id = workout_comments.workout_id)
  );

-- The comment's author can delete it, and so can the owner of the workout it sits on.
drop policy if exists "delete own comment or on own workout" on workout_comments;
create policy "delete own comment or on own workout" on workout_comments
  for delete using (
    auth.uid() = user_id
    or exists (
      select 1 from workouts
      where workouts.id = workout_comments.workout_id and workouts.user_id = auth.uid()
    )
  );
