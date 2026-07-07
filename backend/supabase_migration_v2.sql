-- ============================================================
-- WatchParty: Migration v2
-- Run in Supabase Dashboard → SQL Editor
-- Safe to re-run (all CREATE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
-- ============================================================

-- ── 1. Profiles — one row per user regardless of login method ──────────────
-- Stores guests (provider='guest'), email users, and Google OAuth users.
-- For email/google users, `id` matches the Supabase Auth UUID.
-- For guests, `id` is a client-generated 'guest_<uuid>'.
CREATE TABLE IF NOT EXISTS profiles (
  id            TEXT         PRIMARY KEY,
  display_name  TEXT         NOT NULL DEFAULT 'Guest',
  avatar_url    TEXT         NOT NULL DEFAULT '',
  provider      TEXT         NOT NULL DEFAULT 'guest', -- 'guest' | 'email' | 'google'
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_seen_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Add columns that may be missing if the table already existed
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email        TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url   TEXT NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT 'Guest';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS provider     TEXT NOT NULL DEFAULT 'guest';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Unique email index (only when email is not null — guests have no email)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique
  ON profiles(email)
  WHERE email IS NOT NULL;

-- Fast lookup by provider
CREATE INDEX IF NOT EXISTS profiles_provider_idx ON profiles(provider);

-- RLS: server uses service key (bypasses RLS); direct client access blocked
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ── 2. Add reactions column to chat_messages ───────────────────────────────
-- Stores { "<emoji>": ["userId1", "userId2"], ... }
ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS reactions JSONB NOT NULL DEFAULT '{}';

-- Index for efficient reaction lookups
CREATE INDEX IF NOT EXISTS idx_chat_messages_reactions
  ON chat_messages USING gin(reactions);

-- ── 3. Track which rooms each user has been in (history) ──────────────────
CREATE TABLE IF NOT EXISTS user_room_history (
  id          UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     TEXT         NOT NULL,
  room_id     TEXT         NOT NULL REFERENCES rooms(room_id) ON DELETE CASCADE,
  joined_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, room_id)
);

CREATE INDEX IF NOT EXISTS idx_room_history_user ON user_room_history(user_id);
CREATE INDEX IF NOT EXISTS idx_room_history_room ON user_room_history(room_id);
ALTER TABLE user_room_history ENABLE ROW LEVEL SECURITY;

-- ── 4. Auto-update updated_at on profiles ─────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── 5. Toggle reaction atomically (prevents race conditions) ──────────────
-- Returns the updated reactions JSONB after toggling.
CREATE OR REPLACE FUNCTION toggle_chat_reaction(
  p_message_id  UUID,
  p_emoji       TEXT,
  p_user_id     TEXT
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_reactions   JSONB;
  v_users       TEXT[];
BEGIN
  -- Lock the row for update
  SELECT reactions INTO v_reactions
  FROM chat_messages
  WHERE id = p_message_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN '{}'::JSONB;
  END IF;

  IF v_reactions IS NULL THEN
    v_reactions := '{}'::JSONB;
  END IF;

  -- Get current user list for this emoji
  v_users := ARRAY(
    SELECT jsonb_array_elements_text(COALESCE(v_reactions->p_emoji, '[]'::JSONB))
  );

  IF p_user_id = ANY(v_users) THEN
    -- Remove the user (un-react)
    v_users := ARRAY(
      SELECT u FROM unnest(v_users) u WHERE u <> p_user_id
    );
  ELSE
    -- Add the user (react)
    v_users := array_append(v_users, p_user_id);
  END IF;

  -- Rebuild reactions object
  IF array_length(v_users, 1) IS NULL OR array_length(v_users, 1) = 0 THEN
    v_reactions := v_reactions - p_emoji;
  ELSE
    v_reactions := jsonb_set(v_reactions, ARRAY[p_emoji], to_jsonb(v_users));
  END IF;

  UPDATE chat_messages
  SET reactions = v_reactions
  WHERE id = p_message_id;

  RETURN v_reactions;
END;
$$;
