const DICEBEAR_BASE = 'https://api.dicebear.com/8.x/avataaars/svg?seed=';

/**
 * Generate a deterministic avatar URL from any seed string.
 * @param {string} seed - e.g. displayName or userId
 */
export function generateAvatar(seed) {
  return `${DICEBEAR_BASE}${encodeURIComponent(seed)}`;
}
