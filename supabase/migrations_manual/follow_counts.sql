-- Run this once in the Supabase SQL Editor.
--
-- Exposes follower/following information for ANY user without loosening the `follows` RLS policy.
-- That policy only lets you read rows you're part of, which is right for the raw table, but it
-- makes counting someone else's followers impossible. Widening it is not an option either: a
-- policy on `follows` that itself queries `follows` recurses infinitely in Postgres.
--
-- Both functions are SECURITY DEFINER (so they bypass RLS) but deliberately narrow:
--   * follow_counts returns aggregates only — never who follows whom.
--   * follow_list returns names only when the viewer is allowed to see that profile's content,
--     using the same rule as workouts: it's you, the profile is public, or you're an accepted
--     follower. This mirrors how Instagram shows counts on private accounts but hides the list.
--
-- `set search_path = public` prevents a caller from shadowing the tables these bodies resolve.

create or replace function public.follow_counts(target_id uuid)
returns table (followers integer, following integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*)::integer from follows
      where following_id = target_id and status = 'accepted'),
    (select count(*)::integer from follows
      where follower_id = target_id and status = 'accepted');
$$;

create or replace function public.follow_list(target_id uuid, list_kind text)
returns table (id uuid, username text, avatar_url text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username, p.avatar_url
  from follows f
  join profiles p
    on p.id = case when list_kind = 'followers' then f.follower_id else f.following_id end
  where f.status = 'accepted'
    and (case when list_kind = 'followers' then f.following_id else f.follower_id end) = target_id
    and (
      auth.uid() = target_id
      or exists (select 1 from profiles tp where tp.id = target_id and tp.is_public = true)
      or exists (
        select 1 from follows viewer
        where viewer.follower_id = auth.uid()
          and viewer.following_id = target_id
          and viewer.status = 'accepted'
      )
    )
  order by p.username;
$$;

revoke all on function public.follow_counts(uuid) from public;
revoke all on function public.follow_list(uuid, text) from public;
grant execute on function public.follow_counts(uuid) to authenticated;
grant execute on function public.follow_list(uuid, text) to authenticated;
