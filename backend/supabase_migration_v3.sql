-- ============================================================
-- WatchParty: Migration v3
-- Run in Supabase Dashboard → SQL Editor
-- Safe to re-run (IF NOT EXISTS throughout)
-- ============================================================

-- ── 1. Watch queue items ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS queue_items (
  id            UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id       TEXT         NOT NULL REFERENCES rooms(room_id) ON DELETE CASCADE,
  url           TEXT         NOT NULL,
  title         TEXT         NOT NULL DEFAULT 'Untitled',
  thumbnail     TEXT         NOT NULL DEFAULT '',
  type          TEXT         NOT NULL DEFAULT 'native',  -- 'youtube' | 'native'
  added_by      TEXT         NOT NULL,
  added_by_name TEXT         NOT NULL DEFAULT '',
  vote_count    INTEGER      NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_queue_items_room ON queue_items(room_id, vote_count DESC);

ALTER TABLE queue_items ENABLE ROW LEVEL SECURITY;

-- ── 2. Per-user votes (prevents double-voting) ────────────────────────────
CREATE TABLE IF NOT EXISTS queue_votes (
  id       UUID  DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id  UUID  NOT NULL REFERENCES queue_items(id) ON DELETE CASCADE,
  user_id  TEXT  NOT NULL,
  UNIQUE(item_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_queue_votes_item ON queue_votes(item_id);

ALTER TABLE queue_votes ENABLE ROW LEVEL SECURITY;

-- ── 3. Atomic vote helpers (idempotent re-create) ─────────────────────────
CREATE OR REPLACE FUNCTION increment_queue_vote(item_id_arg UUID)
RETURNS void LANGUAGE sql AS $$
  UPDATE queue_items SET vote_count = vote_count + 1 WHERE id = item_id_arg;
$$;

CREATE OR REPLACE FUNCTION decrement_queue_vote(item_id_arg UUID)
RETURNS void LANGUAGE sql AS $$
  UPDATE queue_items SET vote_count = GREATEST(0, vote_count - 1) WHERE id = item_id_arg;
$$;

-- ── 4. Polls ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS polls (
  id              UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id         TEXT         NOT NULL REFERENCES rooms(room_id) ON DELETE CASCADE,
  question        TEXT         NOT NULL,
  created_by      TEXT         NOT NULL,
  created_by_name TEXT         NOT NULL DEFAULT '',
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
  ends_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_polls_room ON polls(room_id, is_active);
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;

-- ── 5. Poll options (one row per choice) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS poll_options (
  id         UUID     DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id    UUID     NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  text       TEXT     NOT NULL,
  vote_count INTEGER  NOT NULL DEFAULT 0,
  position   INTEGER  NOT NULL DEFAULT 0    -- sort order
);

CREATE INDEX IF NOT EXISTS idx_poll_options_poll ON poll_options(poll_id, position);
ALTER TABLE poll_options ENABLE ROW LEVEL SECURITY;

-- ── 6. Poll votes (one row per user per poll) ─────────────────────────────
CREATE TABLE IF NOT EXISTS poll_votes (
  id        UUID  DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id   UUID  NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  option_id UUID  NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  user_id   TEXT  NOT NULL,
  UNIQUE(poll_id, user_id)   -- one vote per user per poll
);

CREATE INDEX IF NOT EXISTS idx_poll_votes_poll ON poll_votes(poll_id);
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;

-- ── 7. Atomic poll vote helpers ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_poll_vote(option_id_arg UUID)
RETURNS void LANGUAGE sql AS $$
  UPDATE poll_options SET vote_count = vote_count + 1 WHERE id = option_id_arg;
$$;

CREATE OR REPLACE FUNCTION decrement_poll_vote(option_id_arg UUID)
RETURNS void LANGUAGE sql AS $$
  UPDATE poll_options SET vote_count = GREATEST(0, vote_count - 1) WHERE id = option_id_arg;
$$;
