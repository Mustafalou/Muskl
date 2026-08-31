-- Run this once in the Supabase SQL Editor.
alter table profile_stats add column if not exists weekly_goal integer;
