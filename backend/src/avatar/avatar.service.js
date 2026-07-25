// Ready Player Me avatar storage — the avatar itself is just a URL (RPM
// hosts the 3D model + 2D render), so this is deliberately thin compared to
// the old procedural-recipe version it replaces. `profiles` (the app's
// existing user-profile table) is the single source of truth for
// `avatar_url`; `equipped_items` is a per-category cache of the caller's
// currently-equipped inventory items, kept in sync by inventory.routes.js.
const { getSupabase } = require('./supabaseClient');

const RPM_HOST_PATTERN = /^https:\/\/(models|api)\.readyplayer\.me\//;

function isValidRpmUrl(url) {
  return typeof url === 'string' && RPM_HOST_PATTERN.test(url);
}

async function getAvatar(userId) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('profiles')
    .select('avatar_url, equipped_items')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return {
    avatarUrl: data?.avatar_url || null,
    equippedItems: data?.equipped_items || {},
  };
}

async function saveAvatarUrl(userId, avatarUrl) {
  if (!isValidRpmUrl(avatarUrl)) {
    const err = new Error('avatarUrl must be a readyplayer.me URL');
    err.status = 422;
    throw err;
  }
  const sb = getSupabase();
  const { data, error } = await sb
    .from('profiles')
    .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select('avatar_url, equipped_items')
    .single();
  if (error) throw error;
  return { avatarUrl: data.avatar_url, equippedItems: data.equipped_items || {} };
}

// Public identity card — what other users see (member lists, room headers).
async function publicCard(userId) {
  const sb = getSupabase();
  const [{ data: profile }, { data: prog }] = await Promise.all([
    sb.from('profiles').select('display_name, avatar_url, equipped_items').eq('id', userId).maybeSingle(),
    sb.from('user_progression').select('xp, level, title').eq('user_id', userId).maybeSingle(),
  ]);
  return {
    userId,
    name: profile?.display_name || 'WatchParty user',
    avatarUrl: profile?.avatar_url || null,
    equippedItems: profile?.equipped_items || {},
    level: prog?.level || 1,
    title: prog?.title || 'Newcomer',
  };
}

module.exports = { isValidRpmUrl, getAvatar, saveAvatarUrl, publicCard };
