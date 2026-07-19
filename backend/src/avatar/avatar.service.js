const crypto = require('crypto');
const { getSupabase } = require('./supabaseClient');
const { defaultRecipe, validateRecipe, canonicalize, RECIPE_VERSION, progressForXp } = require('../avatar-core');

const BUCKET = process.env.AVATAR_BUCKET || 'avatars';

function hashRecipe(clean) {
  return crypto.createHash('sha256').update(canonicalize(clean)).digest('hex').slice(0, 16);
}

async function loadCatalogIndex() {
  const { data, error } = await getSupabase().from('items').select('*');
  if (error) throw error;
  return new Map(data.map((it) => [it.id, it]));
}

async function getOwnedSet(userId) {
  const { data, error } = await getSupabase()
    .from('user_inventory').select('item_id').eq('user_id', userId);
  if (error) throw error;
  return new Set((data || []).map((r) => r.item_id));
}

async function getOrCreateAvatar(userId) {
  const sb = getSupabase();
  const { data } = await sb.from('avatars').select('*').eq('user_id', userId).maybeSingle();
  if (data) return data;

  const recipe = defaultRecipe();
  const row = {
    user_id: userId,
    recipe,
    recipe_hash: hashRecipe(recipe),
    version: RECIPE_VERSION,
  };
  const { data: created, error } = await sb.from('avatars').insert(row).select().single();
  if (error) throw error;
  return created;
}

async function saveRecipe(userId, recipeInput) {
  const [catalog, ownedSet] = await Promise.all([loadCatalogIndex(), getOwnedSet(userId)]);
  const { ok, errors, clean } = validateRecipe(recipeInput, { catalog, ownedSet });
  if (!ok) {
    const err = new Error('invalid recipe');
    err.status = 422;
    err.details = errors;
    throw err;
  }
  const sb = getSupabase();
  const row = {
    user_id: userId,
    recipe: clean,
    recipe_hash: hashRecipe(clean),
    version: RECIPE_VERSION,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await sb
    .from('avatars').upsert(row, { onConflict: 'user_id' }).select().single();
  if (error) throw error;
  return data;
}

// kinds: { head?: base64png, bust?: base64png, full?: base64png }
async function saveSnapshots(userId, kinds) {
  const sb = getSupabase();
  const avatar = await getOrCreateAvatar(userId);
  const updates = {};

  for (const kind of ['head', 'bust', 'full']) {
    const b64 = kinds[kind];
    if (!b64) continue;
    const buffer = Buffer.from(b64, 'base64');
    if (buffer.length > 4 * 1024 * 1024) {
      const err = new Error(`snapshot '${kind}' too large`);
      err.status = 413;
      throw err;
    }
    const path = `${userId}/${avatar.recipe_hash}-${kind}.png`;
    const { error: upErr } = await sb.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: 'image/png', upsert: true });
    if (upErr) throw upErr;
    const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path);
    updates[`snapshot_${kind}`] = pub.publicUrl;
  }

  if (!Object.keys(updates).length) return avatar;
  const { data, error } = await sb
    .from('avatars').update(updates).eq('user_id', userId).select().single();
  if (error) throw error;
  return data;
}

// Public identity card — what other users see (lobby lists, profiles).
async function publicCard(userId) {
  const sb = getSupabase();
  const [{ data: avatar }, { data: prog }] = await Promise.all([
    sb.from('avatars').select('recipe_hash,snapshot_head,snapshot_bust,snapshot_full,recipe').eq('user_id', userId).maybeSingle(),
    sb.from('user_progression').select('xp').eq('user_id', userId).maybeSingle(),
  ]);

  let name = 'WatchParty user';
  try {
    const { data: u } = await sb.auth.admin.getUserById(userId);
    const meta = (u && u.user && u.user.user_metadata) || {};
    name = meta.full_name || meta.name || meta.user_name
      || (u && u.user && u.user.email ? u.user.email.split('@')[0] : name);
  } catch (_) { /* auth admin unavailable — keep fallback name */ }

  const p = progressForXp(prog ? Number(prog.xp) : 0);
  return {
    userId,
    name,
    level: p.level,
    title: p.title,
    recipeHash: avatar ? avatar.recipe_hash : null,
    frame: avatar && avatar.recipe ? avatar.recipe.frame : null,
    snapshots: avatar ? {
      head: avatar.snapshot_head, bust: avatar.snapshot_bust, full: avatar.snapshot_full,
    } : { head: null, bust: null, full: null },
  };
}

module.exports = {
  hashRecipe, loadCatalogIndex, getOwnedSet,
  getOrCreateAvatar, saveRecipe, saveSnapshots, publicCard,
};
