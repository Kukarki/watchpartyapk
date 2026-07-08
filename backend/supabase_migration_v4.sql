-- ============================================================
-- WatchParty: Migration v4
-- Run in Supabase Dashboard → SQL Editor
-- Safe to re-run (IF NOT EXISTS throughout)
-- ============================================================

-- ── 1. Friendships ────────────────────────────────────────────────────────
-- One row per pair (requester -> addressee) with a status. profiles.id is
-- TEXT (guest ids look like `guest_<uuid>`), so the FKs are TEXT, not UUID.
CREATE TABLE IF NOT EXISTS friendships (
  id           UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id TEXT         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  addressee_id TEXT         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status       TEXT         NOT NULL DEFAULT 'pending',  -- 'pending' | 'accepted' | 'blocked'
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (requester_id, addressee_id),
  CHECK (requester_id <> addressee_id),
  CHECK (status IN ('pending', 'accepted', 'blocked'))
);

CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships(requester_id);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON friendships(addressee_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status    ON friendships(status);

ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
