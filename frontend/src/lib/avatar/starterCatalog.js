// Minimal, hand-picked catalog entries for the items the default recipe (and
// the selfie-analysis flow) reference. The real items catalog lives in
// Supabase and isn't wired up on the web yet -- this stand-in just gives
// buildAvatar() something to resolve so outfits/hair render with real
// colors instead of its generic fallbacks, and gives the profile page's
// pickers something to offer. Item ids match the regex checks buildAvatar()
// already does (hoodie/tee/dress) so the special-cased geometry (hood,
// skirt) kicks in correctly.
const ITEMS = [
  { id: 'hr_short', category: 'hair' },
  { id: 'hr_long', category: 'hair' },
  { id: 'hr_buzz', category: 'hair' },
  { id: 'hr_bob', category: 'hair' },
  { id: 'hr_pony', category: 'hair' },
  { id: 'hr_bun', category: 'hair' },
  { id: 'hr_spikes', category: 'hair' },
  { id: 'hr_curls', category: 'hair' },

  // Tops
  { id: 'it_tee_slate',    category: 'top', name: 'Slate Tee',    colorways: [{ primary: '#5A6273', secondary: '#3A4152' }] },
  { id: 'it_tee_crimson',  category: 'top', name: 'Crimson Tee',  colorways: [{ primary: '#B4362F', secondary: '#7A211C' }] },
  { id: 'it_tee_mint',     category: 'top', name: 'Mint Tee',     colorways: [{ primary: '#5FD8A2', secondary: '#2E8F63' }] },
  { id: 'it_hoodie_violet',   category: 'top', name: 'Violet Hoodie',   colorways: [{ primary: '#8B7CFF', secondary: '#5C4FCC' }] },
  { id: 'it_hoodie_charcoal', category: 'top', name: 'Charcoal Hoodie', colorways: [{ primary: '#2E333F', secondary: '#1B1F27' }] },

  // Bottoms
  { id: 'it_jeans_ink',   category: 'bottom', name: 'Ink Jeans',   colorways: [{ primary: '#2A3242' }] },
  { id: 'it_jeans_light', category: 'bottom', name: 'Light Jeans', colorways: [{ primary: '#6B7A94' }] },
  { id: 'it_shorts_black', category: 'bottom', name: 'Black Shorts', colorways: [{ primary: '#1B1F27' }] },

  // Shoes
  { id: 'it_sneaker_white', category: 'shoes', name: 'White Sneakers', colorways: [{ primary: '#EDEFF4' }] },
  { id: 'it_sneaker_black', category: 'shoes', name: 'Black Sneakers', colorways: [{ primary: '#20242E' }] },
  { id: 'it_boots_brown',   category: 'shoes', name: 'Brown Boots',    colorways: [{ primary: '#6B4A32' }] },

  // Full outfits (override top/bottom when equipped)
  { id: 'it_dress_rose', category: 'outfit_full', name: 'Rose Dress', colorways: [{ primary: '#E6799B', secondary: '#C25578' }] },
  { id: 'it_dress_navy', category: 'outfit_full', name: 'Navy Dress', colorways: [{ primary: '#2C4A8A', secondary: '#1B2F5C' }] },

  { id: 'bg_room', category: 'background', colorways: [{ primary: '#141826', secondary: '#0B0D14' }] },
];

export function buildStarterCatalog() {
  return new Map(ITEMS.map((item) => [item.id, item]));
}

export const CLOTHING_OPTIONS = {
  top:    ITEMS.filter((i) => i.category === 'top'),
  bottom: ITEMS.filter((i) => i.category === 'bottom'),
  shoes:  ITEMS.filter((i) => i.category === 'shoes'),
  full:   ITEMS.filter((i) => i.category === 'outfit_full'),
};
