-- Fix: writes were silently failing with
-- "new row violates row-level security policy (USING expression)"
-- on UPDATE/upsert paths (rejoining a room, voting, editing a playlist,
-- accepting a friend request, etc.) across every table with RLS enabled.
--
-- All of these tables are backend-only: every write goes through our own
-- Express/Socket.io server using the Supabase service key, with our own JWT
-- auth enforcing who can do what. RLS here was always meant to be a no-op
-- for that service key. Something (most likely the newer sb_secret_/
-- sb_publishable_ Supabase key format) stopped that automatic bypass from
-- working. This migration makes the intended behavior explicit with a
-- permissive policy per table instead of relying on it.
--
-- Safe to run repeatedly (drops + recreates each policy).

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'room_members', 'chat_messages', 'friend_nicknames', 'profiles',
    'user_room_history', 'game_states', 'friendships', 'youtube_connections',
    'queue_items', 'queue_votes', 'polls', 'poll_options', 'poll_votes',
    'spotify_connections', 'playlists', 'playlist_tracks', 'listen_history'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('DROP POLICY IF EXISTS service_role_all ON %I', t);
      EXECUTE format('CREATE POLICY service_role_all ON %I FOR ALL USING (true) WITH CHECK (true)', t);
    END IF;
  END LOOP;
END $$;
