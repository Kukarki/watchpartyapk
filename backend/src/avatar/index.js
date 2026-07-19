// WatchParty avatar system — Express module.
//
// Mount in your existing app:
//   const { createAvatarModule } = require('./avatar');       // this folder
//   app.use('/api/v1/avatar-system', createAvatarModule().router);
//
// Grant XP from your room/socket handlers:
//   const { grantXp } = require('./avatar');
//   const result = await grantXp(userId, 'join', { refId: roomId });
//
// Requires env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Optional env: AVATAR_BUCKET (default 'avatars'), AVATAR_DEV_KEY
const express = require('express');

function createAvatarModule() {
  const router = express.Router();
  // snapshots arrive as base64 PNGs — allow a bigger JSON body on this
  // router only (does not change your app-wide limit)
  router.use(express.json({ limit: '16mb' }));

  router.use('/catalog', require('./catalog.routes'));
  router.use('/avatar', require('./avatar.routes'));
  router.use('/inventory', require('./inventory.routes'));
  router.use('/progression', require('./progression.routes'));
  router.use('/stats', require('./stats.routes'));
  router.use('/shop', require('./shop.routes'));
  router.use('/gifts', require('./gifts.routes'));

  // uniform error shape
  // eslint-disable-next-line no-unused-vars
  router.use((err, _req, res, _next) => {
    console.error('[avatar-system]', err);
    res.status(err.status || 500).json({ error: err.message || 'internal error' });
  });

  return { router };
}

module.exports = {
  createAvatarModule,
  grantXp: require('./progression.service').grantXp,
  getProgression: require('./progression.service').getProgression,
  grantItem: require('./economy.service').grantItem,
  grantCoins: require('./economy.service').grantCoins,
  wireAvatarXp: require('./events.example').wireAvatarXp,
};
