-- ============================================================
-- WatchParty: Migration v9
-- Run in Supabase Dashboard → SQL Editor
-- Safe to re-run (IF NOT EXISTS throughout)
-- ============================================================

-- ── 1. Game rooms ─────────────────────────────────────────────────────────
-- room_type already supports free-form values ('watch' | 'music' | 'game' —
-- see v6). game_type identifies which game a 'game' room hosts (e.g. 'ludo').
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS game_type TEXT;

-- ── 2. Generic game state ────────────────────────────────────────────────
-- One row per room, holding that game's current state as JSON. Generic on
-- purpose — adding a second game later needs no new table, just a new
-- backend game module (see backend/src/games/).
CREATE TABLE IF NOT EXISTS game_states (
  room_id    TEXT         PRIMARY KEY REFERENCES rooms(room_id) ON DELETE CASCADE,
  game_type  TEXT         NOT NULL,
  state      JSONB        NOT NULL,
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
ALTER TABLE game_states ENABLE ROW LEVEL SECURITY;
