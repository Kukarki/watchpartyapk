const express = require('express');
const { requireUser } = require('./requireUser');
const { getAvatar, saveAvatarUrl, publicCard } = require('./avatar.service');

const router = express.Router();

// GET /avatar/me — the caller's saved Ready Player Me avatar (if any) + equipped items.
router.get('/me', requireUser, async (req, res, next) => {
  try { res.json(await getAvatar(req.user.id)); } catch (e) { next(e); }
});

// PUT /avatar/me — save the avatar URL exported by the Ready Player Me creator.
router.put('/me', requireUser, async (req, res, next) => {
  try {
    const { avatarUrl } = req.body || {};
    if (!avatarUrl) return res.status(400).json({ error: 'body.avatarUrl required' });
    res.json(await saveAvatarUrl(req.user.id, avatarUrl));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
});

// GET /avatar/card/:userId — public identity card (name, level, avatar, equipped items).
router.get('/card/:userId', requireUser, async (req, res, next) => {
  try { res.json(await publicCard(req.params.userId)); } catch (e) { next(e); }
});

module.exports = router;
