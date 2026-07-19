const express = require('express');
const { getSupabase } = require('./supabaseClient');

const router = express.Router();
let cache = { at: 0, data: null };
const TTL = 60 * 1000;

// GET /catalog/manifest — full cosmetics catalog. Clients cache this and
// lazy-load assets. Adding items to the `items` table updates every client
// within a minute — no app release.
router.get('/manifest', async (_req, res, next) => {
  try {
    const now = Date.now();
    if (!cache.data || now - cache.at > TTL) {
      const { data, error } = await getSupabase()
        .from('items').select('*')
        .order('category', { ascending: true })
        .order('released_at', { ascending: true });
      if (error) throw error;
      cache = { at: now, data: { version: now, items: data } };
    }
    res.json(cache.data);
  } catch (e) { next(e); }
});

module.exports = router;
