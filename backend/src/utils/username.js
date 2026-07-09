function slugify(name) {
  return (name || 'user').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15) || 'user';
}

/**
 * Auto-generate a unique, Instagram-style handle from a display name
 * (e.g. "Kushal Karki" -> "kushal4821"). Checked against `profiles.username`
 * for uniqueness, retrying with a new random suffix on collision.
 */
export async function generateUsername(sb, displayName) {
  const base = slugify(displayName);

  for (let attempt = 0; attempt < 6; attempt++) {
    const suffix = Math.floor(1000 + Math.random() * 9000);
    const candidate = `${base}${suffix}`;
    const { data } = await sb.from('profiles').select('id').eq('username', candidate).maybeSingle();
    if (!data) return candidate;
  }

  // Vanishingly unlikely fallback after repeated collisions.
  return `${base}${Date.now().toString(36)}`;
}
