-- ============================================================
-- WatchParty: Migration v13 — VRoid Hub connection (3D VRM avatar)
-- Run in Supabase Dashboard → SQL Editor
-- Safe to re-run (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS throughout)
-- ============================================================

-- One row per user who has linked their VRoid Hub account. Same
-- OAuth-authorization-code-flow shape as spotify_connections/
-- youtube_connections: access_token is short-lived, refreshed server-side
-- using refresh_token as needed.
CREATE TABLE IF NOT EXISTS vroid_hub_connections (
  user_id        UUID         PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  vroid_user_id  TEXT         NOT NULL,
  access_token   TEXT         NOT NULL,
  refresh_token  TEXT         NOT NULL,
  expires_at     TIMESTAMPTZ  NOT NULL,
  connected_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
ALTER TABLE vroid_hub_connections ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS service_role_all ON vroid_hub_connections;
  CREATE POLICY service_role_all ON vroid_hub_connections FOR ALL USING (true) WITH CHECK (true);
END $$;

-- Which of the user's VRoid Hub models is currently selected as their
-- WatchParty 3D avatar. Nullable — stays set even if the connection is
-- later removed (same behavior as Spotify/YouTube disconnect not wiping
-- already-imported data).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS vrm_model_id TEXT;
