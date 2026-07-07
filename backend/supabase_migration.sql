-- ============================================================
-- WatchParty: Redis → Supabase migration
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Add video-state columns to the existing rooms table
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS is_playing        BOOLEAN          NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS video_position    DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS state_updated_at  BIGINT           NOT NULL DEFAULT 0;

-- 2. Room presence (who is currently online in a room)
CREATE TABLE IF NOT EXISTS room_members (
  id            UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id       TEXT         NOT NULL REFERENCES rooms(room_id) ON DELETE CASCADE,
  user_id       TEXT         NOT NULL,
  display_name  TEXT         NOT NULL DEFAULT '',
  avatar        TEXT         NOT NULL DEFAULT '',
  is_host       BOOLEAN      NOT NULL DEFAULT FALSE,
  joined_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_room_members_room_id
  ON room_members(room_id);

-- 3. Persistent chat history
CREATE TABLE IF NOT EXISTS chat_messages (
  id            UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id       TEXT         NOT NULL REFERENCES rooms(room_id) ON DELETE CASCADE,
  user_id       TEXT         NOT NULL,
  display_name  TEXT         NOT NULL DEFAULT '',
  avatar        TEXT         NOT NULL DEFAULT '',
  content       TEXT         NOT NULL,
  type          TEXT         NOT NULL DEFAULT 'text',
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_room_id_created
  ON chat_messages(room_id, created_at DESC);

-- 4. Row-level security (service key bypasses RLS; anon/user key cannot access directly)
ALTER TABLE room_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- ── Atomic vote helpers (required by queue.controller.js) ──────────────────
-- These replace the broken sb.raw() pattern and prevent race conditions.

CREATE OR REPLACE FUNCTION increment_queue_vote(item_id_arg UUID)
RETURNS void LANGUAGE sql AS $$
  UPDATE queue_items SET vote_count = vote_count + 1 WHERE id = item_id_arg;
$$;

CREATE OR REPLACE FUNCTION decrement_queue_vote(item_id_arg UUID)
RETURNS void LANGUAGE sql AS $$
  UPDATE queue_items SET vote_count = GREATEST(0, vote_count - 1) WHERE id = item_id_arg;
$$;

-- ── Atomic poll vote helpers (required by poll.controller.js) ──────────────
-- Prevent the read-modify-write race condition on poll option counts.

CREATE OR REPLACE FUNCTION increment_poll_vote(option_id_arg UUID)
RETURNS void LANGUAGE sql AS $$
  UPDATE poll_options SET vote_count = vote_count + 1 WHERE id = option_id_arg;
$$;

CREATE OR REPLACE FUNCTION decrement_poll_vote(option_id_arg UUID)
RETURNS void LANGUAGE sql AS $$
  UPDATE poll_options SET vote_count = GREATEST(0, vote_count - 1) WHERE id = option_id_arg;
$$;

-- ── Fix state_updated_at column type ──────────────────────────────────────
-- Originally created as BIGINT (epoch ms); room.service.js now writes ISO strings.
-- Convert the column to TIMESTAMPTZ, preserving any existing epoch-ms values.

ALTER TABLE rooms
  ALTER COLUMN state_updated_at TYPE TIMESTAMPTZ
  USING CASE
    WHEN state_updated_at = 0 THEN NULL
    ELSE to_timestamp(state_updated_at / 1000.0)
  END;
