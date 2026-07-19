// Gifting: buy a shop item for another user. The recipient gets a pending
// gift and receives the item when they open it (reveal moment on the client).
const express = require('express');
const { requireUser } = require('./requireUser');
const { getSupabase } = require('./supabaseClient');
const { spendCurrency, grantItem } = require('./economy.service');

const router = express.Router();

// POST /gifts { itemId, toUserId, message? }
router.post('/', requireUser, async (req, res, next) => {
  try {
    const fromUser = req.user.id;
    const { itemId, toUserId, message } = req.body || {};
    if (!itemId || !toUserId) return res.status(400).json({ error: 'itemId and toUserId required' });
    if (toUserId === fromUser) return res.status(400).json({ error: 'cannot gift yourself' });

    const sb = getSupabase();
    const { data: item } = await sb.from('items').select('*').eq('id', itemId).maybeSingle();
    if (!item) return res.status(404).json({ error: 'unknown item' });
    if (!['shop', 'gift_only'].includes(item.unlock_type)) {
      return res.status(403).json({ error: `'${item.name}' cannot be gifted` });
    }

    const { data: theirRow } = await sb
      .from('user_inventory').select('item_id')
      .eq('user_id', toUserId).eq('item_id', itemId).maybeSingle();
    if (theirRow) return res.status(409).json({ error: 'they already own this item' });

    const currency = item.price_coins != null ? 'coins' : 'gems';
    const amount = item.price_coins != null ? item.price_coins : item.price_gems;
    if (amount == null) return res.status(400).json({ error: 'item has no price' });

    await spendCurrency(fromUser, currency, amount, 'gift_sent', itemId);

    const { data: gift, error } = await sb.from('gifts').insert({
      from_user: fromUser, to_user: toUserId, item_id: itemId,
      message: (message || '').slice(0, 200) || null,
    }).select().single();
    if (error) throw error; // FK failure here means toUserId doesn't exist

    res.json({ ok: true, giftId: gift.id, paid: { currency, amount } });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
});

// GET /gifts/me — pending gifts waiting to be opened
router.get('/me', requireUser, async (req, res, next) => {
  try {
    const sb = getSupabase();
    const { data: gifts, error } = await sb
      .from('gifts').select('*')
      .eq('to_user', req.user.id).eq('status', 'sent')
      .order('created_at', { ascending: false });
    if (error) throw error;

    const ids = [...new Set((gifts || []).map((g) => g.item_id))];
    let itemsById = {};
    if (ids.length) {
      const { data: items } = await sb.from('items').select('*').in('id', ids);
      itemsById = Object.fromEntries((items || []).map((it) => [it.id, it]));
    }
    res.json({ gifts: (gifts || []).map((g) => ({ ...g, item: itemsById[g.item_id] || null })) });
  } catch (e) { next(e); }
});

// POST /gifts/:id/open — grants the item, marks the gift opened
router.post('/:id/open', requireUser, async (req, res, next) => {
  try {
    const sb = getSupabase();
    const { data: gift } = await sb
      .from('gifts').select('*').eq('id', req.params.id).maybeSingle();
    if (!gift || gift.to_user !== req.user.id) return res.status(404).json({ error: 'gift not found' });
    if (gift.status !== 'sent') return res.status(409).json({ error: 'already opened' });

    await grantItem(req.user.id, gift.item_id, 'gift');
    await sb.from('gifts').update({ status: 'opened' }).eq('id', gift.id);

    const { data: item } = await sb.from('items').select('*').eq('id', gift.item_id).maybeSingle();
    res.json({ ok: true, item, from: gift.from_user, message: gift.message });
  } catch (e) { next(e); }
});

module.exports = router;
