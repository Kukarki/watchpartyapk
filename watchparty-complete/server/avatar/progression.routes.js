const express = require('express');
const { requireUser } = require('./requireUser');
const { getSupabase } = require('./supabaseClient');
const { grantXp, getProgression } = require('./progression.service');
const { grantCoins, grantRandomItemOfRarity } = require('./economy.service');
const { unlockedTitles, loginMultiplier, streakRewardForDay } = require('../avatar-core');

const router = express.Router();

router.get('/me', requireUser, async (req, res, next) => {
  try {
    const p = await getProgression(req.user.id);
    const sb = getSupabase();
    const [{ data: wallet }, { data: streak }] = await Promise.all([
      sb.from('wallets').select('coins,gems').eq('user_id', req.user.id).maybeSingle(),
      sb.from('login_streaks').select('*').eq('user_id', req.user.id).maybeSingle(),
    ]);
    res.json({
      ...p,
      titles: unlockedTitles(p.level),
      wallet: wallet || { coins: 0, gems: 0 },
      streak: streak ? { current: streak.current, longest: streak.longest, shields: streak.shields } : { current: 0, longest: 0, shields: 0 },
    });
  } catch (e) { next(e); }
});

// Daily login claim: advances the streak, pays the streak reward, grants
// login XP with the streak multiplier. Idempotent per UTC day.
router.post('/login/claim', requireUser, async (req, res, next) => {
  try {
    const sb = getSupabase();
    const userId = req.user.id;
    const dayStr = (d) => d.toISOString().slice(0, 10);
    const today = dayStr(new Date());
    const yesterday = dayStr(new Date(Date.now() - 86400000));
    const twoDaysAgo = dayStr(new Date(Date.now() - 2 * 86400000));

    const { data: row } = await sb
      .from('login_streaks').select('*').eq('user_id', userId).maybeSingle();
    const cur = row || { current: 0, longest: 0, shields: 0, last_claim: null };

    if (cur.last_claim === today) {
      return res.json({ alreadyClaimed: true, streak: cur.current, shields: cur.shields });
    }

    let usedShield = false;
    let streak;
    if (cur.last_claim === yesterday) {
      streak = cur.current + 1;
    } else if (cur.last_claim === twoDaysAgo && cur.shields > 0) {
      // one missed day, auto-bridged by a streak shield
      cur.shields -= 1;
      usedShield = true;
      streak = cur.current + 1;
    } else {
      // broken streak: restart at day 3 if the lost streak was >= 14
      streak = cur.current >= 14 ? 3 : 1;
    }

    let shields = cur.shields;
    if (streak > 0 && streak % 7 === 0) shields = Math.min(2, shields + 1);
    const longest = Math.max(cur.longest || 0, streak);

    const { error: upErr } = await sb.from('login_streaks').upsert({
      user_id: userId, current: streak, longest, shields, last_claim: today,
    }, { onConflict: 'user_id' });
    if (upErr) throw upErr;

    // reward for this streak day
    const def = streakRewardForDay(streak);
    const reward = { coins: 0, item: null };
    if (def.coins) {
      const r = await grantCoins(userId, def.coins, 'streak', `day-${streak}`);
      reward.coins = def.coins;
      reward.balance = r.coins;
    }
    if (def.itemRarity) {
      const item = await grantRandomItemOfRarity(userId, def.itemRarity, 'streak');
      if (item) reward.item = { id: item.id, name: item.name, rarity: item.rarity, category: item.category };
      else {
        // owns everything of that rarity — pay coins instead
        const fallback = 200;
        await grantCoins(userId, fallback, 'streak_fallback', `day-${streak}`);
        reward.coins += fallback;
      }
    }

    const xp = await grantXp(userId, 'login', { multiplier: loginMultiplier(streak) });
    res.json({ alreadyClaimed: false, streak, shields, usedShield, reward, xp });
  } catch (e) { next(e); }
});

// Dev/test grant endpoint — enabled only when AVATAR_DEV_KEY is set and
// matches the X-Dev-Key header. Handy for testing challenges before the
// challenge engine exists. Remove in production if you prefer.
router.post('/grant', requireUser, async (req, res, next) => {
  try {
    const devKey = process.env.AVATAR_DEV_KEY;
    if (!devKey || req.headers['x-dev-key'] !== devKey) {
      return res.status(403).json({ error: 'dev grants disabled' });
    }
    const { source, refId, multiplier } = req.body || {};
    const result = await grantXp(req.user.id, source, { refId, multiplier });
    res.json(result);
  } catch (e) { next(e); }
});

module.exports = router;
