-- ============================================================
-- WatchParty: Migration v7
-- Run in Supabase Dashboard → SQL Editor
-- Safe to re-run (IF NOT EXISTS throughout)
-- ============================================================

-- ── 1. Spotify connections ──────────────────────────────────────────────────
-- One row per user who has linked their Spotify account. Tokens are the
-- OAuth authorization-code-flow access/refresh token pair; access_token is
-- short-lived (~1hr) and refreshed server-side using refresh_token as needed.
CREATE TABLE IF NOT EXISTS spotify_connections (
  user_id         UUID         PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  spotify_user_id TEXT         NOT NULL,
  access_token    TEXT         NOT NULL,
  refresh_token   TEXT         NOT NULL,
  expires_at      TIMESTAMPTZ  NOT NULL,
  connected_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
ALTER TABLE spotify_connections ENABLE ROW LEVEL SECURITY;
