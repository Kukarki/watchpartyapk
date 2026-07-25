// ESM port of backend/src/avatar-core (which is CommonJS, shared with the
// Expo app on purpose). Vite/ESM can't `require()` that file directly, so
// this is a parallel copy of just the constants + defaultRecipe() needed to
// render an avatar. Keep in sync by hand if the backend source changes —
// there's no build step linking the two.

export const SKIN_TONES = [
  { id: 's01', hex: '#F6E3D5' }, { id: 's02', hex: '#F2D3BC' },
  { id: 's03', hex: '#EAC1A3' }, { id: 's04', hex: '#E0B08D' },
  { id: 's05', hex: '#D49E77' }, { id: 's06', hex: '#C68863' },
  { id: 's07', hex: '#B57450' }, { id: 's08', hex: '#A26240' },
  { id: 's09', hex: '#8E5233' }, { id: 's10', hex: '#7A4429' },
  { id: 's11', hex: '#663821' }, { id: 's12', hex: '#532C1A' },
  { id: 's13', hex: '#402114' }, { id: 's14', hex: '#2E170E' },
];

export const HAIR_COLORS = [
  { id: 'c_ink', hex: '#1B1B22' }, { id: 'c_espresso', hex: '#3B2A20' },
  { id: 'c_chestnut', hex: '#5C4030' }, { id: 'c_caramel', hex: '#8A5A33' },
  { id: 'c_sand', hex: '#C29155' }, { id: 'c_blonde', hex: '#E3C27C' },
  { id: 'c_platinum', hex: '#EFE7D4' }, { id: 'c_silver', hex: '#B9C0CC' },
  { id: 'c_crimson', hex: '#B4362F' }, { id: 'c_rose', hex: '#E6799B' },
  { id: 'c_violet', hex: '#8B7CFF' }, { id: 'c_blue', hex: '#3D7BF5' },
  { id: 'c_cyan', hex: '#35E0D0' }, { id: 'c_mint', hex: '#5FD8A2' },
  { id: 'c_amber', hex: '#FFB454' }, { id: 'c_white', hex: '#F4F6FA' },
];

export const EYE_COLORS = [
  { id: 'c_umber', hex: '#4A2E1D' }, { id: 'c_hazel', hex: '#7A5A2E' },
  { id: 'c_forest', hex: '#3E6B45' }, { id: 'c_jade', hex: '#3FBF8F' },
  { id: 'c_ice', hex: '#8FD0F5' }, { id: 'c_sky', hex: '#3FA9F5' },
  { id: 'c_navy', hex: '#2C4A8A' }, { id: 'c_violet_e', hex: '#8B7CFF' },
  { id: 'c_magenta', hex: '#D25BAE' }, { id: 'c_ember', hex: '#E0642F' },
  { id: 'c_gold', hex: '#D9A93C' }, { id: 'c_onyx', hex: '#20242E' },
];

// sx/sy scale the (otherwise plain-sphere) head. The original values here
// were subtle (~±12%), tuned for a photoreal head mesh where even small
// proportion shifts read clearly -- on a low-poly sphere they were nearly
// invisible, so every face shape looked like the same round blob. Widened
// to ~±25-40% so picking a shape (manually or via the selfie flow) actually
// looks different, while keeping the cartoon/low-poly silhouette.
export const FACE_SHAPES = [
  { id: 'f1', name: 'Round',  sx: 1.00, sy: 1.00 },
  { id: 'f2', name: 'Oval',   sx: 0.82, sy: 1.20 },
  { id: 'f3', name: 'Square', sx: 1.14, sy: 0.90 },
  { id: 'f4', name: 'Heart',  sx: 1.06, sy: 1.10 },
  { id: 'f5', name: 'Long',   sx: 0.74, sy: 1.32 },
  { id: 'f6', name: 'Soft',   sx: 1.10, sy: 1.06 },
  { id: 'f7', name: 'Sharp',  sx: 0.88, sy: 0.98 },
  { id: 'f8', name: 'Wide',   sx: 1.28, sy: 0.86 },
];

export const EYE_STYLES = [
  { id: 'e1', name: 'Classic', scale: 1.00, tilt: 0 },
  { id: 'e2', name: 'Wide',    scale: 1.20, tilt: 0 },
  { id: 'e3', name: 'Soft',    scale: 1.05, tilt: 0.12 },
  { id: 'e4', name: 'Sharp',   scale: 0.90, tilt: -0.16 },
  { id: 'e5', name: 'Sleepy',  scale: 0.85, tilt: 0.05 },
  { id: 'e6', name: 'Big',     scale: 1.35, tilt: 0.05 },
];

export const BROW_STYLES = [
  { id: 'br1', name: 'Straight', w: 1.0, angle: 0 },
  { id: 'br2', name: 'Arched',   w: 1.0, angle: 0.28 },
  { id: 'br3', name: 'Thick',    w: 1.5, angle: 0.10 },
  { id: 'br4', name: 'Thin',     w: 0.6, angle: 0.12 },
  { id: 'br5', name: 'Angled',   w: 1.1, angle: -0.30 },
  { id: 'br6', name: 'Soft',     w: 0.9, angle: 0.18 },
];

export const NOSE_STYLES = [
  { id: 'n1', name: 'Small',   scale: 0.80 },
  { id: 'n2', name: 'Classic', scale: 1.00 },
  { id: 'n3', name: 'Button',  scale: 1.15 },
  { id: 'n4', name: 'Pointed', scale: 1.00 },
];

export const EXPRESSIONS = [
  { id: 'soft_smile', name: 'Smile',   emoji: '🙂' },
  { id: 'grin',       name: 'Grin',    emoji: '😁' },
  { id: 'neutral',    name: 'Neutral', emoji: '😐' },
  { id: 'cool',       name: 'Cool',    emoji: '😎' },
  { id: 'shock',      name: 'Shock',   emoji: '😱' },
  { id: 'sleepy',     name: 'Sleepy',  emoji: '😴' },
  { id: 'sad',        name: 'Sad',     emoji: '🥺' },
  { id: 'laugh',      name: 'Laugh',   emoji: '😂' },
];

export const BODY_TYPES = [
  { id: 'b1', name: 'Slim',     w: 0.92, h: 1.00 },
  { id: 'b2', name: 'Regular',  w: 1.00, h: 1.00 },
  { id: 'b3', name: 'Athletic', w: 1.12, h: 1.02 },
  { id: 'b4', name: 'Broad',    w: 1.24, h: 1.04 },
];

export const POSES = [
  { id: 'idle_stand',        name: 'Stand' },
  { id: 'idle_lean',         name: 'Lean' },
  { id: 'idle_arms_crossed', name: 'Crossed' },
];

const RECIPE_VERSION = 2;

// Note: outfit/hair/background reference catalog item ids that don't exist
// yet on the web (the items catalog is still backend-only, in progress).
// buildAvatar()'s fallback-everywhere design renders a perfectly reasonable
// default look even when those ids resolve to nothing in an empty catalog.
export function defaultRecipe() {
  return {
    v: RECIPE_VERSION,
    body: { type: 'b2', height: 0.5, skin: 's06', posture: 'idle_stand' },
    face: {
      shape: 'f1',
      eyes: { id: 'e1', color: 'c_umber' },
      brows: 'br1',
      nose: 'n2',
      details: [],
      expression: 'soft_smile',
    },
    hair: { id: 'hr_short', color: 'c_ink', fx: null },
    outfit: { top: 'it_tee_slate', bottom: 'it_jeans_ink', shoes: 'it_sneaker_white', full: null },
    accessories: { head: null, ears: null, face: null, hands: null, back: null },
    effects: [],
    frame: null,
    background: 'bg_room',
    pose: 'idle_stand',
  };
}
