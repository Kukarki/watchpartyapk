import { readUpFace } from './diceGeometry.js';

/**
 * Applies a resolved throw (from findThrowForTarget, or a fallback preset)
 * to a live RigidBody-like ref -- works with both a raw Rapier RigidBody
 * and an @react-three/rapier <RigidBody> ref, since both expose the same
 * setTranslation/setRotation/setLinvel/setAngvel API.
 */
export function applyDiceThrow(bodyRef, throwParams) {
  const [px, py, pz] = throwParams.position;
  const [lx, ly, lz] = throwParams.linvel;
  const [ax, ay, az] = throwParams.angvel;
  bodyRef.setTranslation({ x: px, y: py, z: pz }, true);
  bodyRef.setRotation(throwParams.quaternion, true);
  bodyRef.setLinvel({ x: lx, y: ly, z: lz }, true);
  bodyRef.setAngvel({ x: ax, y: ay, z: az }, true);
}

/**
 * Dev-only self-check: call once the visible body has come to rest, to
 * confirm the replay actually reproduced the target face. A mismatch is a
 * visual/tuning bug to fix, never a gameplay-correctness bug -- legal
 * moves/HUD/bot decisions all read the target value the instant the roll
 * provider resolves it, never from the settled physics.
 */
export function readSettledFace(bodyRef) {
  return readUpFace(bodyRef.rotation());
}
