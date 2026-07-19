const express = require('express');
const { requireUser } = require('./requireUser');
const { getSupabase } = require('./supabaseClient');

const router = express.Router();

// GET /inventory/me — everything the caller owns, with catalog rows joined.
router.get('/me', requireUser, async (req, res, next) => {
  try {
    const sb = getSupabase();
    const { data: owned, error } = await sb
      .from('user_inventory')
      .select('item_id, source, acquired_at')
      .eq('user_id', req.user.id)
      .order('acquired_at', { ascending: false });
    if (error) throw error;

    const ids = (owned || []).map((r) => r.item_id);
    let itemsById = {};
    if (ids.length) {
      const { data: items, error: itemsErr } = await sb
        .from('items').select('*').in('id', ids);
      if (itemsErr) throw itemsErr;
      itemsById = Object.fromEntries(items.map((it) => [it.id, it]));
    }

    res.json({
      items: (owned || []).map((r) => ({ ...r, item: itemsById[r.item_id] || null })),
    });
  } catch (e) { next(e); }
});

module.exports = router;
