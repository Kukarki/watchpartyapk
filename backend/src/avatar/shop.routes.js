// Shop: browse + purchase with coins/gems. Featured rotation is
// deterministic per UTC day (no cron needed) with a discount on the first
// two slots. Prices are recomputed server-side at purchase time, so the
// client can never send its own price.
const express = require('express');
const { requireUser } = require('./requireUser');
const { getSupabase } = require('./supabaseClient');
const { getProgression } = require('./progression.service');
const { ensureWallet, spendCurrency, grantItem } = require('./economy.service');

const router = express.Router();

function dailySeed() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
}
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function featuredToday(items) {
  const seed = dailySeed();
  const pool = items.filter((it) => it.unlock_type === 'shop');
  const sorted = [...pool].sort((a, b) => hashStr(seed + a.id) - hashStr(seed + b.id));
  return sorted.slice(0, 6).map((it, i) => ({ item: it, discountPct: i < 2 ? 15 : 0 }));
}
function effectivePrice(item, discountPct) {
  const cut = (v) => (v == null ? null : Math.round(v * (100 - discountPct) / 100));
  return discountPct
    ? { coins: cut(item.price_coins), gems: cut(item.price_gems) }
    : { coins: item.price_coins, gems: item.price_gems };
}

async function loadItems() {
  const { data, error } = await getSupabase().from('items').select('*');
  if (error) throw error;
  return data;
}

// GET /shop — wallet + level + today's featured (with discounts) + catalog
router.get('/', requireUser, async (req, res, next) => {
  try {
    const sb = getSupabase();
    const [items, prog, wallet, { data: owned }] = await Promise.all([
      loadItems(),
      getProgression(req.user.id),
      ensureWallet(req.user.id),
      sb.from('user_inventory').select('item_id').eq('user_id', req.user.id),
    ]);
    const ownedSet = new Set((owned || []).map((r) => r.item_id));

    const featured = featuredToday(items).map(({ item, discountPct }) => ({
      ...item,
      discountPct,
      price: effectivePrice(item, discountPct),
      owned: ownedSet.has(item.id),
    }));

    const catalog = items
      .filter((it) => it.unlock_type === 'shop')
      .map((it) => ({
        ...it,
        price: { coins: it.price_coins, gems: it.price_gems },
        owned: ownedSet.has(it.id),
      }));

    res.json({
      wallet: { coins: Number(wallet.coins), gems: Number(wallet.gems) },
      level: prog.level,
      rotatesAtUtcMidnight: true,
      featured,
      catalog,
    });
  } catch (e) { next(e); }
});

// POST /shop/purchase { itemId, currency? } — currency defaults to whichever
// the item is priced in (coins preferred when both exist).
router.post('/purchase', requireUser, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { itemId } = req.body || {};
    if (!itemId) return res.status(400).json({ error: 'itemId required' });

    const items = await loadItems();
    const item = items.find((it) => it.id === itemId);
    if (!item) return res.status(404).json({ error: 'unknown item' });
    if (item.unlock_type !== 'shop') {
      return res.status(403).json({ error: `'${item.name}' is not sold in the shop` });
    }

    const nowIso = new Date().toISOString();
    if (item.available_from && item.available_from > nowIso) {
      return res.status(403).json({ error: 'not available yet' });
    }
    if (item.available_to && item.available_to < nowIso) {
      return res.status(403).json({ error: 'no longer available' });
    }

    const prog = await getProgression(userId);
    if (item.min_level > prog.level) {
      return res.status(403).json({ error: `unlocks at Level ${item.min_level}` });
    }

    const sb = getSupabase();
    const { data: ownedRow } = await sb
      .from('user_inventory').select('item_id')
      .eq('user_id', userId).eq('item_id', itemId).maybeSingle();
    if (ownedRow) return res.status(409).json({ error: 'already owned' });

    // authoritative price (today's featured discount applies automatically)
    const feat = featuredToday(items).find((f) => f.item.id === itemId);
    const price = effectivePrice(item, feat ? feat.discountPct : 0);

    let currency = req.body.currency;
    if (!currency) currency = price.coins != null ? 'coins' : 'gems';
    const amount = price[currency];
    if (amount == null) {
      return res.status(400).json({ error: `'${item.name}' has no ${currency} price` });
    }

    const { balance } = await spendCurrency(userId, currency, amount, 'purchase', itemId);
    await grantItem(userId, itemId, 'shop');

    const wallet = await ensureWallet(userId);
    res.json({
      ok: true,
      item: { id: item.id, name: item.name, rarity: item.rarity, category: item.category },
      paid: { currency, amount, discountPct: feat ? feat.discountPct : 0 },
      wallet: { coins: Number(wallet.coins), gems: Number(wallet.gems) },
      balance,
    });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
});

module.exports = router;
