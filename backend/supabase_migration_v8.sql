-- ============================================================
-- WatchParty: Migration v8
-- Run in Supabase Dashboard → SQL Editor
-- Safe to re-run (IF NOT EXISTS throughout)
-- ============================================================

-- ── 1. YouTube connections ───────────────────────────────────────────────
-- One row per user who has linked their YouTube/Google account (read-only
-- access to their own playlists — no upload/write scopes requested).
CREATE TABLE IF NOT EXISTS youtube_connections (
  user_id        UUID         PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  google_user_id TEXT         NOT NULL,
  channel_title  TEXT         NOT NULL DEFAULT '',
  access_token   TEXT         NOT NULL,
  refresh_token  TEXT         NOT NULL,
  expires_at     TIMESTAMPTZ  NOT NULL,
  connected_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
ALTER TABLE youtube_connections ENABLE ROW LEVEL SECURITY;
