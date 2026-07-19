const express = require('express');
const { requireUser } = require('./requireUser');
const { getSupabase } = require('./supabaseClient');

const router = express.Router();

async function countEvents(sb, userId, source) {
  const { count, error } = await sb
    .from('xp_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId).eq('source', source);
  if (error) throw error;
  return count || 0;
}

// GET /stats/me — profile stats grid, computed from the activity ledger.
// (Hours socializing needs playback/presence heartbeats — wire those in
// Phase 3; until then the grid shows verified session counts.)
router.get('/me', requireUser, async (req, res, next) => {
  try {
    const sb = getSupabase();
    const userId = req.user.id;

    const [roomsJoined, roomsHosted, watchSessions, invitesAccepted] = await Promise.all([
      countEvents(sb, userId, 'join'),
      countEvents(sb, userId, 'host'),
      countEvents(sb, userId, 'watch'),
      countEvents(sb, userId, 'invite'),
    ]);

    const { count: friends } = await sb
      .from('friendships')
      .select('user_a', { count: 'exact', head: true })
      .eq('status', 'accepted')
      .or(`user_a.eq.${userId},user_b.eq.${userId}`);

    const { data: streak } = await sb
      .from('login_streaks').select('current,longest').eq('user_id', userId).maybeSingle();

    res.json({
      roomsJoined,
      roomsHosted,
      watchSessions,
      invitesAccepted,
      friends: friends || 0,
      streak: streak ? streak.current : 0,
      longestStreak: streak ? streak.longest : 0,
    });
  } catch (e) { next(e); }
});

module.exports = router;
