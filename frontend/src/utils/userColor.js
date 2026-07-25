// Deterministic per-name color, so the same person always gets the same
// color across chat bubbles, avatars, and member chips — the site and the
// extension overlay (extension/src/overlay/overlay.js, which can't import
// this — content scripts can't be ES modules) use the same hex values in
// the same order so a person's color matches in both places.
const PALETTE = [
  { hex: '#f5a623', tint: 'bg-amber/20 text-amber' },
  { hex: '#3b82f6', tint: 'bg-info/20 text-info' },
  { hex: '#22d3a0', tint: 'bg-online/20 text-online' },
  { hex: '#ff4757', tint: 'bg-danger/20 text-danger' },
  { hex: '#8896b0', tint: 'bg-sub/20 text-sub' },
];

function paletteIndex(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash) % PALETTE.length;
}

export function getUserColorHex(name) {
  return PALETTE[paletteIndex(name)].hex;
}

export function getUserColorTint(name) {
  return PALETTE[paletteIndex(name)].tint;
}
