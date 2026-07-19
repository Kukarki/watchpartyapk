// Wires game results into the avatar XP system + Supabase history.
// game_play / game_win XP sources ship in avatar-core/xpRules.js.
// Used automatically by attachGamesWithAvatarXp() — see index.js.
function makeOnGameEnd({ grantXp, supabase, io }) {
  return async function onGameEnd({ session, ranking }) {
    // XP for everyone, bonus for the winner (caps enforced inside grantXp)
    for (const pid of ranking) {
      try {
        const r = await grantXp(pid, 'game_play', { refId: session.sessionId });
        if (r.granted && io) io.to(`gs:${session.sessionId}`).emit('xp:awarded', { ...r, userId: pid });
      } catch (err) { console.error('[games-xp]', err.message); }
    }
    if (ranking[0]) {
      try {
        const r = await grantXp(ranking[0], 'game_win', { refId: session.sessionId });
        if (r.granted && io) io.to(`gs:${session.sessionId}`).emit('xp:awarded', { ...r, userId: ranking[0] });
      } catch (err) { console.error('[games-xp]', err.message); }
    }
    // optional history row (see supabase/003_game_results.sql)
    if (supabase) {
      await supabase.from('game_results').insert({
        session_id: session.sessionId,
        room_id: session.roomId,
        game_id: session.gameId,
        ranking,
      }).then(({ error }) => error && console.error('[games-db]', error.message));
    }
  };
}
module.exports = { makeOnGameEnd };
