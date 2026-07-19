const { getSupabase } = require('./supabaseClient');
const { XP_SOURCES, levelForXp, titleForLevel, progressForXp, coinsForLevelUp } = require('../avatar-core');
const { grantCoins, grantItem } = require('./economy.service');

function utcDayStart(d = new Date()) {
  const t = new Date(d);
  t.setUTCHours(0, 0, 0, 0);
  return t.toISOString();
}

function utcWeekStart(d = new Date()) {
  const t = new Date(d);
  t.setUTCHours(0, 0, 0, 0);
  const day = t.getUTCDay(); // 0 Sun .. 6 Sat
  const diff = (day + 6) % 7; // days since Monday
  t.setUTCDate(t.getUTCDate() - diff);
  return t.toISOString();
}

async function getProgressionRow(userId) {
  const sb = getSupabase();
  const { data } = await sb.from('user_progression').select('*').eq('user_id', userId).maybeSingle();
  if (data) return data;
  const { data: created, error } = await sb
    .from('user_progression').insert({ user_id: userId }).select().single();
  if (error) throw error;
  return created;
}

async function getProgression(userId) {
  const row = await getProgressionRow(userId);
  return progressForXp(Number(row.xp));
}

/**
 * Grant XP to a user. Server-side only — call this from your existing
 * socket/room handlers (see events.example.js).
 *
 * @param {string} userId
 * @param {string} source  one of XP_SOURCES keys
 * @param {object} opts    { refId, multiplier }
 * @returns {{granted, capped, amount, level, into, needed, title, leveledUp, coinsAwarded}}
 */
async function grantXp(userId, source, opts = {}) {
  const rule = XP_SOURCES[source];
  if (!rule) throw new Error(`unknown xp source '${source}'`);
  const sb = getSupabase();

  // ---- cap checks (per UTC day / week) ---------------------------------
  if (rule.dailyCap) {
    const { count, error } = await sb
      .from('xp_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('source', source)
      .gte('created_at', utcDayStart());
    if (error) throw error;
    if ((count || 0) >= rule.dailyCap) {
      return { granted: false, capped: true, amount: 0, ...(await getProgression(userId)) };
    }
  }

  if (rule.weeklyCap) {
    const { count, error } = await sb
      .from('xp_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('source', source)
      .gte('created_at', utcWeekStart());
    if (error) throw error;
    if ((count || 0) >= rule.weeklyCap) {
      return { granted: false, capped: true, amount: 0, ...(await getProgression(userId)) };
    }
  }

  let amount = Math.round(rule.amount * (opts.multiplier || 1));

  if (rule.dailyXpCap) {
    const { data, error } = await sb
      .from('xp_events').select('amount')
      .eq('user_id', userId).eq('source', source)
      .gte('created_at', utcDayStart());
    if (error) throw error;
    const spent = (data || []).reduce((s, r) => s + Number(r.amount), 0);
    amount = Math.min(amount, rule.dailyXpCap - spent);
    if (amount <= 0) {
      return { granted: false, capped: true, amount: 0, ...(await getProgression(userId)) };
    }
  }

  // ---- ledger + rollup --------------------------------------------------
  const { error: evErr } = await sb.from('xp_events').insert({
    user_id: userId, source, amount, ref_id: opts.refId || null,
  });
  if (evErr) throw evErr;

  const row = await getProgressionRow(userId);
  const newXp = Number(row.xp) + amount;
  const newLevel = levelForXp(newXp);
  const leveledUp = newLevel > row.level;

  const { error: upErr } = await sb.from('user_progression').update({
    xp: newXp, level: newLevel, title: titleForLevel(newLevel),
    updated_at: new Date().toISOString(),
  }).eq('user_id', userId);
  if (upErr) throw upErr;

  let coinsAwarded = 0;
  const itemsUnlocked = [];
  if (leveledUp) {
    coinsAwarded = coinsForLevelUp(row.level, newLevel);
    await grantCoins(userId, coinsAwarded, 'levelup', `L${row.level}->L${newLevel}`);

    // auto-grant level-reward cosmetics reached by the new level
    // (seeded examples: hr_wolfcut/hr_curls at 5, fr_slate at 10)
    const { data: unlockables } = await sb
      .from('items').select('id,name,rarity,category,min_level')
      .eq('unlock_type', 'level')
      .gt('min_level', row.level)
      .lte('min_level', newLevel);
    for (const it of unlockables || []) {
      await grantItem(userId, it.id, 'level'); // upsert — safe if already owned
      itemsUnlocked.push(it);
    }
  }

  return {
    granted: true, capped: false, amount, source,
    ...progressForXp(newXp), leveledUp, coinsAwarded, itemsUnlocked,
  };
}

module.exports = { grantXp, getProgression, getProgressionRow, utcDayStart, utcWeekStart };
