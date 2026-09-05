-- Remembers that a user has been through the post-signup questionnaire, so it is asked exactly
-- once, and keeps the answers: the level is worth having for later (adapting suggestions), and the
-- frequency answer also seeds `weekly_goal`, which is what the streak is computed against.
alter table profile_stats add column if not exists onboarded_at timestamptz;
alter table profile_stats add column if not exists training_level text;
