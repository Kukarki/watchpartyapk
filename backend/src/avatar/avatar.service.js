// Avatar storage — `profiles` (the app's existing user-profile table) is
// the single source of truth for `avatar_url` (a DiceBear image URL by
// default, editable on the Profile page); `equipped_items` is a
// per-category cache of the caller's currently-equipped inventory items,
// kept in sync by inventory.routes.js.
const { getSupabase } = require('./supabaseClient');

function isValidAvatarUrl(url) {
  if (typeof url !== 'string' || !url) return false;
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
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
  if (!isValidAvatarUrl(avatarUrl)) {
    const err = new Error('avatarUrl must be a valid https URL');
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

module.exports = { isValidAvatarUrl, getAvatar, saveAvatarUrl, publicCard };
