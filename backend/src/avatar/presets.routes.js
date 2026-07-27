// Preset 3D avatars — a ready-to-use gallery requiring zero setup, no
// VRoid Hub account needed. See supabase_migration_v14.sql for the
// preset_avatars table and its CC0-licensed seed data (sourced from
// github.com/ToxSam/open-source-avatars).
const express = require('express');
const { requireUser } = require('./requireUser');
const { getSupabase } = require('./supabaseClient');

const router = express.Router();

// GET /presets — the full gallery. No auth needed to browse.
router.get('/', async (req, res, next) => {
  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('preset_avatars')
      .select('id, name, thumbnail_url, vrm_url')
      .order('name');
    if (error) throw error;
    res.json({ presets: data || [] });
  } catch (e) { next(e); }
});

// GET /presets/me — the caller's currently-selected preset, if any.
router.get('/me', requireUser, async (req, res, next) => {
  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('profiles')
      .select('preset_avatar_id, preset_avatars(id, name, thumbnail_url, vrm_url)')
      .eq('id', req.user.id)
      .maybeSingle();
    if (error) throw error;
    res.json({ preset: data?.preset_avatars || null });
  } catch (e) { next(e); }
});

// POST /presets/select — pick one. Also clears any VRoid Hub selection
// (vrm_model_id) since a user's 3D avatar comes from exactly one source
// at a time.
router.post('/select', requireUser, async (req, res, next) => {
  try {
    const { presetId } = req.body || {};
    if (!presetId) return res.status(400).json({ error: 'presetId is required' });

    const sb = getSupabase();
    const { data: preset, error: presetErr } = await sb
      .from('preset_avatars').select('id').eq('id', presetId).maybeSingle();
    if (presetErr) throw presetErr;
    if (!preset) return res.status(404).json({ error: 'Unknown preset' });

    const { error } = await sb
      .from('profiles')
      .update({ preset_avatar_id: presetId, vrm_model_id: null })
      .eq('id', req.user.id);
    if (error) throw error;

    res.json({ selected: true, presetId });
  } catch (e) { next(e); }
});

module.exports = router;
