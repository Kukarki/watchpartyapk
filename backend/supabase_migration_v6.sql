-- ============================================================
-- WatchParty: Migration v6
-- Run in Supabase Dashboard → SQL Editor
-- Safe to re-run (IF NOT EXISTS throughout)
-- ============================================================

-- ── 1. Room type ──────────────────────────────────────────────────────────
-- Distinguishes video watch-parties from music listening rooms. Existing
-- rooms default to 'watch' so nothing about them changes.
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS room_type TEXT NOT NULL DEFAULT 'watch';

-- ── 2. Playlists ──────────────────────────────────────────────────────────
-- Durable, user-owned, optionally shareable — distinct from the ephemeral,
-- room-scoped, consume-on-play queue_items/queue_votes (v3). profiles.id is
-- UUID in this project's live schema, so FKs match that type.
CREATE TABLE IF NOT EXISTS playlists (
  id         UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id   UUID         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name       TEXT         NOT NULL DEFAULT 'My Playlist',
  is_public  BOOLEAN      NOT NULL DEFAULT false,
  share_code TEXT         UNIQUE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_playlists_owner ON playlists(owner_id);
ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS playlist_tracks (
  id          UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  playlist_id UUID         NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  url         TEXT         NOT NULL,
  title       TEXT         NOT NULL DEFAULT 'Untitled',
  thumbnail   TEXT         NOT NULL DEFAULT '',
  type        TEXT         NOT NULL DEFAULT 'youtube', -- 'youtube' | 'native'
  added_by    UUID         NOT NULL REFERENCES profiles(id),
  position    INTEGER      NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist ON playlist_tracks(playlist_id, position);
ALTER TABLE playlist_tracks ENABLE ROW LEVEL SECURITY;

-- ── 3. Listen history ─────────────────────────────────────────────────────
-- One row per track played in a music room (see room.socket.js video:change_url).
CREATE TABLE IF NOT EXISTS listen_history (
  id         UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  room_id    TEXT         REFERENCES rooms(room_id) ON DELETE SET NULL,
  url        TEXT         NOT NULL,
  title      TEXT         NOT NULL DEFAULT 'Untitled',
  thumbnail  TEXT         NOT NULL DEFAULT '',
  type       TEXT         NOT NULL DEFAULT 'youtube',
  played_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_listen_history_user ON listen_history(user_id, played_at DESC);
ALTER TABLE listen_history ENABLE ROW LEVEL SECURITY;
