import * as THREE from 'three';

// Small procedural canvas textures -- no external asset dependency. A flat
// meshStandardMaterial color reads as painted plastic; a little fine-grain
// noise (felt) or streaky variation (wood) is what actually sells "real
// tabletop material" at this scale. Generated once per color and cached
// module-level, so every cell/board piece sharing a color reuses the same
// GPU texture instead of paying for N copies.
const cache = new Map();

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function clamp8(v) {
  return Math.max(0, Math.min(255, v));
}

/** Fine-grain noise color texture -- reads as fabric/felt rather than flat plastic. */
export function getFeltColorTexture(hex, { size = 256, amount = 14, repeat = 3 } = {}) {
  const key = `felt-color:${hex}:${amount}:${repeat}`;
  if (cache.has(key)) return cache.get(key);

  const [r, g, b] = hexToRgb(hex);
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    img.data[i] = clamp8(r + n);
    img.data[i + 1] = clamp8(g + n);
    img.data[i + 2] = clamp8(b + n);
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  cache.set(key, texture);
  return texture;
}

/** Grayscale noise usable as a roughnessMap -- fibers catch light unevenly. */
export function getFeltRoughnessTexture({ size = 192, base = 200, amount = 60, repeat = 3 } = {}) {
  const key = `felt-rough:${base}:${amount}:${repeat}`;
  if (cache.has(key)) return cache.get(key);

  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = clamp8(base + (Math.random() - 0.5) * amount);
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.anisotropy = 8;
  cache.set(key, texture);
  return texture;
}

/** Streaky wood-grain color texture for the board's base slab. */
export function getWoodColorTexture(hex, { size = 512, repeat = 2 } = {}) {
  const key = `wood-color:${hex}:${repeat}`;
  if (cache.has(key)) return cache.get(key);

  const [r, g, b] = hexToRgb(hex);
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 90; i++) {
    const y = Math.random() * size;
    const h = 1 + Math.random() * 3;
    const shade = (Math.random() - 0.5) * 50;
    ctx.fillStyle = `rgba(${clamp8(r + shade)},${clamp8(g + shade)},${clamp8(b + shade)},${0.12 + Math.random() * 0.18})`;
    ctx.fillRect(0, y, size, h);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  cache.set(key, texture);
  return texture;
}
