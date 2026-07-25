// Lightweight, dependency-free selfie color estimation — no third-party
// API, no ML model download, photo never leaves the device. Samples average
// pixel color from a couple of fixed regions of the captured frame (assumes
// a roughly centered face, like every selfie-guide UI encourages) and snaps
// each sample to the nearest swatch in the app's own DiceBear color palette.

function hexToRgb(hex) {
  const n = parseInt(hex, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function nearestHex(targetRgb, palette) {
  let best = palette[0];
  let bestDist = Infinity;
  for (const hex of palette) {
    const c = hexToRgb(hex);
    const dist = (c.r - targetRgb.r) ** 2 + (c.g - targetRgb.g) ** 2 + (c.b - targetRgb.b) ** 2;
    if (dist < bestDist) { bestDist = dist; best = hex; }
  }
  return best;
}

function averageColor(ctx, x, y, w, h) {
  const { data } = ctx.getImageData(x, y, w, h);
  let r = 0, g = 0, b = 0;
  const pixels = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i]; g += data[i + 1]; b += data[i + 2];
  }
  return { r: r / pixels, g: g / pixels, b: b / pixels };
}

// canvas: an HTMLCanvasElement already holding the captured frame.
// Returns { skinColor, hairColor } as hex strings matched to the given palettes.
export function estimateAvatarColors(canvas, { skinPalette, hairPalette }) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;

  // Cheek/forehead area — roughly center of a face-centered selfie.
  const skinRgb = averageColor(ctx, Math.round(w * 0.38), Math.round(h * 0.4), Math.round(w * 0.24), Math.round(h * 0.15));
  // Hairline/top-of-head area.
  const hairRgb = averageColor(ctx, Math.round(w * 0.32), Math.round(h * 0.06), Math.round(w * 0.36), Math.round(h * 0.12));

  return {
    skinColor: nearestHex(skinRgb, skinPalette),
    hairColor: nearestHex(hairRgb, hairPalette),
  };
}
