import { getHeadlessDieWorld } from './rapierSetup.js';
import { readUpFace } from './diceGeometry.js';
import { getFallbackThrow } from './diceFallbackPresets.js';
import { SPAWN, THROW_VELOCITY, SEARCH_LIMITS, TRAY_WORLD_POSITION } from './constants.js';

export class DiceSearchExhaustedError extends Error {
  constructor(targetValue, attempts) {
    super(`Could not find a throw landing on ${targetValue} after ${attempts} attempts`);
    this.name = 'DiceSearchExhaustedError';
    this.targetValue = targetValue;
    this.attempts = attempts;
  }
}

function randRange([min, max], rng) {
  return min + rng() * (max - min);
}

function eulerToQuat(x, y, z) {
  const cx = Math.cos(x / 2), sx = Math.sin(x / 2);
  const cy = Math.cos(y / 2), sy = Math.sin(y / 2);
  const cz = Math.cos(z / 2), sz = Math.sin(z / 2);
  return {
    x: sx * cy * cz - cx * sy * sz,
    y: cx * sy * cz + sx * cy * sz,
    z: cx * cy * sz - sx * sy * cz,
    w: cx * cy * cz + sx * sy * sz,
  };
}

function randomThrowParams(rng) {
  const [tx, , tz] = TRAY_WORLD_POSITION;
  const position = [
    tx + (rng() * 2 - 1) * SPAWN.jitterXZ,
    randRange(SPAWN.heightRange, rng),
    tz + (rng() * 2 - 1) * SPAWN.jitterXZ,
  ];
  const quaternion = eulerToQuat(rng() * Math.PI * 2, rng() * Math.PI * 2, rng() * Math.PI * 2);
  const linvel = [
    randRange(THROW_VELOCITY.linXZRange, rng),
    randRange(THROW_VELOCITY.linYRange, rng),
    randRange(THROW_VELOCITY.linXZRange, rng),
  ];
  const angvel = [
    (rng() * 2 - 1) * THROW_VELOCITY.angMax,
    (rng() * 2 - 1) * THROW_VELOCITY.angMax,
    (rng() * 2 - 1) * THROW_VELOCITY.angMax,
  ];
  return { position, quaternion, linvel, angvel };
}

function applyThrow(body, throwParams) {
  const [px, py, pz] = throwParams.position;
  const [lx, ly, lz] = throwParams.linvel;
  const [ax, ay, az] = throwParams.angvel;
  body.setTranslation({ x: px, y: py, z: pz }, true);
  body.setRotation(throwParams.quaternion, true);
  body.setLinvel({ x: lx, y: ly, z: lz }, true);
  body.setAngvel({ x: ax, y: ay, z: az }, true);
}

function stepUntilSettled(world, body, maxSteps) {
  for (let i = 0; i < maxSteps; i++) {
    world.step();
    if (body.isSleeping()) break;
  }
  return readUpFace(body.rotation());
}

/**
 * Headless pre-search: tries randomized throws in a pooled, invisible
 * physics world until one settles on `targetValue`, then returns those
 * exact throw parameters for the caller to replay in the visible world.
 * The visible throw is therefore a genuine, un-doctored simulation -- only
 * its *initial conditions* are pre-selected.
 *
 * @param {1|2|3|4|5|6} targetValue
 * @param {{maxAttempts?:number, rng?:()=>number}} [opts]
 * @returns {Promise<{position:number[], quaternion:{x,y,z,w}, linvel:number[], angvel:number[], attempts:number}>}
 */
export async function findThrowForTarget(targetValue, opts = {}) {
  const { maxAttempts = SEARCH_LIMITS.maxAttempts, rng = Math.random } = opts;
  const { world, body } = await getHeadlessDieWorld();

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const throwParams = randomThrowParams(rng);
    applyThrow(body, throwParams);
    const settledValue = stepUntilSettled(world, body, SEARCH_LIMITS.maxStepsPerAttempt);

    if (settledValue === targetValue) {
      return { ...throwParams, attempts: attempt };
    }

    // Yield periodically so a slow search (rare) can't stutter a
    // concurrently-playing rattle animation/sound on the main thread.
    if (attempt % SEARCH_LIMITS.yieldEveryNAttempts === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  throw new DiceSearchExhaustedError(targetValue, maxAttempts);
}

/**
 * The function callers should actually use: findThrowForTarget(), falling
 * back to the pre-verified preset for that face on the (~0.05%-chance)
 * exhausted-search case, so a roll can never simply fail to resolve.
 * @param {1|2|3|4|5|6} targetValue
 * @param {{maxAttempts?:number, rng?:()=>number}} [opts]
 */
export async function resolveThrowForTarget(targetValue, opts = {}) {
  try {
    return await findThrowForTarget(targetValue, opts);
  } catch (err) {
    if (err instanceof DiceSearchExhaustedError) {
      return { ...getFallbackThrow(targetValue), attempts: opts.maxAttempts ?? SEARCH_LIMITS.maxAttempts, fallback: true };
    }
    throw err;
  }
}
