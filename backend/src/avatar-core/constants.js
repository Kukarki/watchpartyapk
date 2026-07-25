// Shared constants for the WatchParty avatar/inventory system.
// Used by BOTH the Express backend and client apps (CommonJS on purpose).

const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

const RARITY_COLORS = {
  common: '#9AA3B2',
  uncommon: '#3DDC84',
  rare: '#29B6FF',
  epic: '#A46CFF',
  legendary: '#FFB454',
  mythic: '#FF4D6D',
};

// Item categories stored in the `items` catalog table. These are decorative
// cosmetic slots layered around a Ready Player Me avatar in WatchParty's own
// UI (background behind the avatar circle, a frame/border, a badge) — not
// literally reapplied onto the 3D RPM model itself.
const CATEGORIES = [
  'clothes', 'hats', 'glasses', 'shoes',
  'backgrounds', 'room_decorations', 'special_items',
];

module.exports = { RARITIES, RARITY_COLORS, CATEGORIES };
