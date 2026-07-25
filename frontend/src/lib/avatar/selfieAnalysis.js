// Selfie -> avatar attribute analysis. Runs entirely in the browser (WASM
// via MediaPipe) -- the photo never leaves the device, nothing is uploaded.
//
// Honest scope: with a single 2D photo and no training data of our own, we
// can reasonably estimate face shape (from landmark geometry) and skin/hair
// color (from pixel sampling). True hairstyle classification (buzzcut vs
// bob vs pony vs...) isn't something a landmark model can tell you -- so we
// only guess hair *length* (short vs long) rather than pretending to detect
// a specific cut. Everything this returns is still fully editable afterward.
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { SKIN_TONES, HAIR_COLORS, FACE_SHAPES } from './avatarCore.js';

const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

let landmarkerPromise = null;
function getLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = FilesetResolver.forVisionTasks(WASM_BASE).then((fileset) =>
      FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
        outputFaceBlendshapes: false,
        runningMode: 'IMAGE',
        numFaces: 1,
      }),
    );
  }
  return landmarkerPromise;
}

// Landmark indices from MediaPipe's standard 478-point face mesh topology.
const PT = {
  foreheadTop: 10, chin: 152,
  cheekLeft: 234, cheekRight: 454,
  jawLeft: 172, jawRight: 397,
  templeLeft: 127, templeRight: 356,
  noseTip: 4, betweenBrows: 168,
  cheekSampleLeft: 116, cheekSampleRight: 345,
  earLeft: 234, earRight: 454,
};

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function nearestByColor(list, [r, g, b]) {
  let best = list[0], bestD = Infinity;
  for (const opt of list) {
    const hex = opt.hex.replace('#', '');
    const or = parseInt(hex.slice(0, 2), 16);
    const og = parseInt(hex.slice(2, 4), 16);
    const ob = parseInt(hex.slice(4, 6), 16);
    const d = (r - or) ** 2 + (g - og) ** 2 + (b - ob) ** 2;
    if (d < bestD) { bestD = d; best = opt; }
  }
  return best.id;
}

function samplePixel(ctx, x, y) {
  const px = ctx.getImageData(Math.max(0, Math.round(x)), Math.max(0, Math.round(y)), 1, 1).data;
  return [px[0], px[1], px[2]];
}

function sampleAverage(ctx, points) {
  let r = 0, g = 0, b = 0;
  for (const [x, y] of points) {
    const [pr, pg, pb] = samplePixel(ctx, x, y);
    r += pr; g += pg; b += pb;
  }
  const n = points.length;
  return [r / n, g / n, b / n];
}

function classifyFaceShape(lm) {
  const faceLength = dist(lm[PT.foreheadTop], lm[PT.chin]);
  const faceWidth = dist(lm[PT.cheekLeft], lm[PT.cheekRight]);
  const jawWidth = dist(lm[PT.jawLeft], lm[PT.jawRight]);
  const foreheadWidth = dist(lm[PT.templeLeft], lm[PT.templeRight]);

  const lengthToWidth = faceLength / (faceWidth || 1);
  const jawToForehead = jawWidth / (foreheadWidth || 1);

  // Coarse, rule-of-thumb classification -- fun-feature accuracy, not
  // clinical. Maps onto whichever of our 8 built-in shapes is closest.
  if (lengthToWidth > 1.35) return 'f5'; // Long
  if (lengthToWidth < 1.05) return jawToForehead > 0.9 ? 'f1' : 'f8'; // Round : Wide
  if (jawToForehead < 0.75) return 'f4'; // Heart
  if (jawToForehead > 1.05) return 'f3'; // Square
  return 'f2'; // Oval
}

/**
 * Analyze a captured photo (an HTMLImageElement/HTMLCanvasElement/HTMLVideoElement,
 * already loaded) and return { skin, faceShape, hairColor, hairStyle } ids.
 * Throws if no face is detected.
 */
export async function analyzeSelfie(imageSource, sourceCanvasCtx, width, height) {
  const landmarker = await getLandmarker();
  const result = landmarker.detect(imageSource);
  const faces = result.faceLandmarks;
  if (!faces || faces.length === 0) {
    throw new Error('No face detected — try a well-lit, front-facing photo.');
  }
  // Convert normalized (0-1) landmarks to pixel coordinates.
  const lm = faces[0].map((p) => ({ x: p.x * width, y: p.y * height }));

  const faceShape = classifyFaceShape(lm);

  const skinRGB = sampleAverage(sourceCanvasCtx, [
    [lm[PT.noseTip].x, lm[PT.noseTip].y],
    [lm[PT.betweenBrows].x, lm[PT.betweenBrows].y],
    [lm[PT.cheekSampleLeft].x, lm[PT.cheekSampleLeft].y],
    [lm[PT.cheekSampleRight].x, lm[PT.cheekSampleRight].y],
  ]);
  const skin = nearestByColor(SKIN_TONES, skinRGB);

  // Hair color: sample above the forehead landmark, scaled by face height
  // so it works regardless of how close/far the photo was taken.
  const faceH = dist(lm[PT.foreheadTop], lm[PT.chin]);
  const hairY = lm[PT.foreheadTop].y - faceH * 0.35;
  const hairRGB = sampleAverage(sourceCanvasCtx, [
    [lm[PT.foreheadTop].x, hairY],
    [lm[PT.foreheadTop].x - faceH * 0.15, hairY + faceH * 0.05],
    [lm[PT.foreheadTop].x + faceH * 0.15, hairY + faceH * 0.05],
  ]);
  const hairColor = nearestByColor(HAIR_COLORS, hairRGB);

  // Hair length: rough guess only (see file header). Check whether
  // hair-colored pixels extend well below the ears on both sides.
  const belowEarY = lm[PT.chin].y + faceH * 0.15;
  const leftBelowEar = samplePixel(sourceCanvasCtx, lm[PT.earLeft].x - faceH * 0.1, belowEarY);
  const rightBelowEar = samplePixel(sourceCanvasCtx, lm[PT.earRight].x + faceH * 0.1, belowEarY);
  const closeToHair = (rgb) => {
    const d = (rgb[0] - hairRGB[0]) ** 2 + (rgb[1] - hairRGB[1]) ** 2 + (rgb[2] - hairRGB[2]) ** 2;
    return d < 2200; // loose threshold -- this is a coarse guess, not precise
  };
  const hairStyle = (closeToHair(leftBelowEar) || closeToHair(rightBelowEar)) ? 'hr_long' : 'hr_short';

  return { skin, faceShape, hairColor, hairStyle };
}

export function isSelfieAnalysisSupported() {
  return typeof WebAssembly !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}
