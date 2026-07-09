-- ============================================================
-- WatchParty: Migration v5
-- Run in Supabase Dashboard → SQL Editor
-- Safe to re-run (IF NOT EXISTS / WHERE username IS NULL throughout)
-- ============================================================

-- ── 1. Usernames ─────────────────────────────────────────────────────────
-- Instagram-style unique handle, auto-assigned at signup, immutable after
-- that (there is no update endpoint for it — see auth.controller.js).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);

-- Backfill existing rows that predate this column. Base slug from
-- display_name + a random 6-hex-char suffix (from gen_random_uuid) to
-- keep collisions effectively impossible even for large backfills.
UPDATE profiles
SET username = left(lower(regexp_replace(coalesce(nullif(display_name, ''), 'user'), '[^a-zA-Z0-9]', '', 'g')), 15)
                || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)
WHERE username IS NULL;
