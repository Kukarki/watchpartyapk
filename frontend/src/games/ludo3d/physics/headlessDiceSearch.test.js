import { describe, it, expect, afterAll } from 'vitest';
import { findThrowForTarget } from './headlessDiceSearch.js';
import { ensureRapierInit, createDieWorld, freeHeadlessDieWorld } from './rapierSetup.js';
import { readUpFace } from './diceGeometry.js';
import { applyDiceThrow } from './diceReplay.js';
import { PHYSICS_TIMESTEP } from './constants.js';

// Replays a resolved throw in a genuinely separate World instance (not the
// pooled singleton reproducing itself) and steps it to rest, mirroring what
// the real visible R3F <Physics timeStep={1/60}> world will do. This is the
// direct empirical test of the design's core claim: "same engine, same
// initial conditions => same settled face."
async function replayInFreshWorld(throwParams) {
  await ensureRapierInit();
  const { world, body } = createDieWorld();
  applyDiceThrow(body, throwParams);
  for (let i = 0; i < 300 && !body.isSleeping(); i++) world.step();
  const face = readUpFace(body.rotation());
  world.free();
  return face;
}

afterAll(() => {
  freeHeadlessDieWorld();
});

describe('headlessDiceSearch', () => {
  it('search finds a throw that settles on the requested face, for every face 1-6', async () => {
    for (let target = 1; target <= 6; target++) {
      const throwParams = await findThrowForTarget(target);
      expect(throwParams.attempts).toBeGreaterThan(0);
      expect(throwParams.attempts).toBeLessThanOrEqual(40);
    }
  }, 30000);

  it('replaying the exact found throw in a fresh world reproduces the same settled face', async () => {
    for (let target = 1; target <= 6; target++) {
      const throwParams = await findThrowForTarget(target);
      const replayedFace = await replayInFreshWorld(throwParams);
      expect(replayedFace).toBe(target);
    }
  }, 30000);

  it('search stays within a fast, predictable attempt budget across many rolls', async () => {
    const attemptCounts = [];
    for (let i = 0; i < 30; i++) {
      const target = 1 + Math.floor(Math.random() * 6);
      const { attempts } = await findThrowForTarget(target);
      attemptCounts.push(attempts);
    }
    const avg = attemptCounts.reduce((a, b) => a + b, 0) / attemptCounts.length;
    // ~1/6 odds per attempt => expected ~6; a generous upper bound catches a
    // badly-biased random-parameter range without being a flaky exact check.
    expect(avg).toBeLessThan(15);
  }, 30000);

  it('uses a fixed timestep matching the visible world requirement', async () => {
    const { world } = await import('./rapierSetup.js').then((m) => m.getHeadlessDieWorld());
    expect(world.timestep).toBeCloseTo(PHYSICS_TIMESTEP, 5);
  });
});
