// Minimal, hand-picked catalog entries for the items the default recipe (and
// the selfie-analysis flow) reference. The real items catalog lives in
// Supabase and isn't wired up on the web yet -- this stand-in just gives
// buildAvatar() something to resolve so outfits/hair render with real
// colors instead of its generic fallbacks, and so hairstyle actually
// changes visually when set.
const ITEMS = [
  { id: 'hr_short', category: 'hair' },
  { id: 'hr_long', category: 'hair' },
  { id: 'hr_buzz', category: 'hair' },
  { id: 'hr_bob', category: 'hair' },
  { id: 'hr_pony', category: 'hair' },
  { id: 'it_tee_slate', category: 'top', colorways: [{ primary: '#5A6273', secondary: '#3A4152' }] },
  { id: 'it_jeans_ink', category: 'bottom', colorways: [{ primary: '#2A3242' }] },
  { id: 'it_sneaker_white', category: 'shoes', colorways: [{ primary: '#EDEFF4' }] },
  { id: 'bg_room', category: 'background', colorways: [{ primary: '#141826', secondary: '#0B0D14' }] },
];

export function buildStarterCatalog() {
  return new Map(ITEMS.map((item) => [item.id, item]));
}
