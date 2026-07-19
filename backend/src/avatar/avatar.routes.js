const express = require('express');
const { requireUser } = require('./requireUser');
const {
  getOrCreateAvatar, saveRecipe, saveSnapshots, publicCard,
} = require('./avatar.service');

const router = express.Router();

// GET /avatar/me — the caller's avatar row (creates the default on first call)
router.get('/me', requireUser, async (req, res, next) => {
  try { res.json(await getOrCreateAvatar(req.user.id)); } catch (e) { next(e); }
});

// PUT /avatar/me — save a recipe. Validated server-side against the catalog
// and the caller's inventory; 422 with details on locked/unknown items.
router.put('/me', requireUser, async (req, res, next) => {
  try {
    const recipe = req.body && req.body.recipe;
    if (!recipe) return res.status(400).json({ error: 'body.recipe required' });
    const row = await saveRecipe(req.user.id, recipe);
    res.json(row);
  } catch (e) {
    if (e.status === 422) return res.status(422).json({ error: e.message, details: e.details });
    next(e);
  }
});

// POST /avatar/me/snapshots — { head?, bust?, full? } as base64 PNGs.
// Captured by the client after a successful save; uploaded to Storage.
router.post('/me/snapshots', requireUser, async (req, res, next) => {
  try {
    const { head, bust, full } = req.body || {};
    const row = await saveSnapshots(req.user.id, { head, bust, full });
    res.json({
      snapshot_head: row.snapshot_head,
      snapshot_bust: row.snapshot_bust,
      snapshot_full: row.snapshot_full,
      recipe_hash: row.recipe_hash,
    });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
});

// GET /avatar/card/:userId — public identity card (name, level, snapshots).
// What lobby lists / other users' profile views consume.
router.get('/card/:userId', requireUser, async (req, res, next) => {
  try { res.json(await publicCard(req.params.userId)); } catch (e) { next(e); }
});

module.exports = router;
