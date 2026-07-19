// WatchParty games module.
//
// Standalone (no XP):
//   const { attachGames } = require('./games');
//   attachGames(io);
//
// Integrated with the avatar system (XP + game history) — recommended:
//   const { attachGamesWithAvatarXp } = require('./games');
//   attachGamesWithAvatarXp(io);
//
// Both expect your socket auth to set socket.data.userId (same assumption
// as the avatar module).
const { attachGames, GAMES } = require('./engine');
const { makeOnGameEnd } = require('./xpHook');

function attachGamesWithAvatarXp(io) {
  // server/games and server/avatar are siblings in the installed layout
  const { grantXp } = require('../avatar');
  const { getSupabase } = require('../avatar/supabaseClient');
  return attachGames(io, {
    onGameEnd: makeOnGameEnd({ grantXp, supabase: getSupabase(), io }),
  });
}

module.exports = { attachGames, attachGamesWithAvatarXp, GAMES };
