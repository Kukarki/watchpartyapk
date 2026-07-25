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
      .select('item_id, source, acquired_at, equipped')
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

// Shared by /equip and /unequip — toggles user_inventory.equipped, updates the
// profiles.equipped_items cache (one item per category), then broadcasts the
// change to any rooms the caller is currently in. Never touches video sync.
async function setEquipped(req, res, next, equipped) {
  try {
    const sb = getSupabase();
    const userId = req.user.id;
    const { itemId } = req.params;

    const { data: owned, error: ownedErr } = await sb
      .from('user_inventory')
      .select('item_id')
      .eq('user_id', userId)
      .eq('item_id', itemId)
      .maybeSingle();
    if (ownedErr) throw ownedErr;
    if (!owned) return res.status(404).json({ error: 'item not owned' });

    const { data: item, error: itemErr } = await sb
      .from('items').select('category').eq('id', itemId).single();
    if (itemErr) throw itemErr;

    const { error: updErr } = await sb
      .from('user_inventory')
      .update({ equipped })
      .eq('user_id', userId).eq('item_id', itemId);
    if (updErr) throw updErr;

    const { data: profile, error: profErr } = await sb
      .from('profiles').select('equipped_items').eq('id', userId).maybeSingle();
    if (profErr) throw profErr;

    const equippedItems = { ...(profile?.equipped_items || {}) };
    if (equipped) equippedItems[item.category] = itemId;
    else if (equippedItems[item.category] === itemId) delete equippedItems[item.category];

    const { error: saveErr } = await sb
      .from('profiles').update({ equipped_items: equippedItems }).eq('id', userId);
    if (saveErr) throw saveErr;

    // Broadcast to any rooms the caller is currently in — additive, doesn't
    // touch room.socket.js internals or video sync at all.
    if (req.io) {
      const { data: memberships } = await sb
        .from('room_members').select('room_id').eq('user_id', userId);
      for (const { room_id: roomId } of memberships || []) {
        req.io.to(roomId).emit('member:avatar_updated', { userId, equippedItems });
      }
    }

    res.json({ equippedItems });
  } catch (e) { next(e); }
}

router.post('/:itemId/equip', requireUser, (req, res, next) => setEquipped(req, res, next, true));
router.post('/:itemId/unequip', requireUser, (req, res, next) => setEquipped(req, res, next, false));

module.exports = router;
