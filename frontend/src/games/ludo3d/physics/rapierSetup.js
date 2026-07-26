import RAPIER from '@dimforge/rapier3d-compat';
import { PHYSICS_TIMESTEP, DIE_HALF_EXTENT, DIE_MATERIAL } from './constants.js';
import { buildHeadlessTrayColliders } from './diceTray.js';

// Module-level memoized promise -- safe under React 18 StrictMode's
// double-invoke (a repeated call just returns the same in-flight/resolved
// promise), and safe to call from anywhere without worrying about ordering.
let initPromise = null;
export function ensureRapierInit() {
  if (!initPromise) initPromise = RAPIER.init();
  return initPromise;
}

// Builds a standalone { world, body } pair (tray colliders + a dynamic die
// body), fully independent of any other instance. Exported mainly so tests
// can verify the "same engine, same inputs => same outcome" replay claim
// against a genuinely separate world, not the pooled singleton reproducing
// itself.
export function createDieWorld() {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = PHYSICS_TIMESTEP;

  buildHeadlessTrayColliders(RAPIER, world);

  const bodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 0.3, 0);
  const body = world.createRigidBody(bodyDesc);
  const colliderDesc = RAPIER.ColliderDesc
    .cuboid(DIE_HALF_EXTENT, DIE_HALF_EXTENT, DIE_HALF_EXTENT)
    .setDensity(DIE_MATERIAL.density)
    .setFriction(DIE_MATERIAL.friction)
    .setRestitution(DIE_MATERIAL.restitution);
  world.createCollider(colliderDesc, body);

  return { world, body, RAPIER };
}

// Pooled, not recreated per search attempt: one headless World + tray +
// die RigidBody, constructed once and reused for the whole page session.
// Rapier owns WASM linear memory for these objects -- freeHeadlessDieWorld()
// must be called on unmount (JS GC won't reclaim it).
let headlessWorldSingleton = null;

export async function getHeadlessDieWorld() {
  await ensureRapierInit();
  if (!headlessWorldSingleton) headlessWorldSingleton = createDieWorld();
  return headlessWorldSingleton;
}

export function freeHeadlessDieWorld() {
  if (headlessWorldSingleton) {
    headlessWorldSingleton.world.free();
    headlessWorldSingleton = null;
  }
}
