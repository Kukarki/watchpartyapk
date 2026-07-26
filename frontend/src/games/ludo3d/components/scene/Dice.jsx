import { forwardRef, useRef, useImperativeHandle, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { DIE_HALF_EXTENT, DIE_MATERIAL, TRAY_WORLD_POSITION } from '../../physics/constants.js';
import { FACE_NORMALS } from '../../physics/diceGeometry.js';
import { resolveThrowForTarget } from '../../physics/headlessDiceSearch.js';
import { applyDiceThrow, readSettledFace } from '../../physics/diceReplay.js';
import { playDiceRattle, playDiceLand, RATTLE_DURATION_MS } from '../../audio/sfx.js';

const SIZE = DIE_HALF_EXTENT * 2;

// Standard pip layouts on a 3x3 grid, centered at (0,0).
const PIP_LAYOUTS = {
  1: [[0, 0]],
  2: [[-1, 1], [1, -1]],
  3: [[-1, 1], [0, 0], [1, -1]],
  4: [[-1, 1], [1, 1], [-1, -1], [1, -1]],
  5: [[-1, 1], [1, 1], [0, 0], [-1, -1], [1, -1]],
  6: [[-1, 1], [1, 1], [-1, 0], [1, 0], [-1, -1], [1, -1]],
};

function faceTangents(normal) {
  const [nx, ny] = normal;
  if (nx !== 0) return [[0, 1, 0], [0, 0, 1]];
  if (ny !== 0) return [[1, 0, 0], [0, 0, 1]];
  return [[1, 0, 0], [0, 1, 0]];
}

function Pips() {
  const pipRadius = DIE_HALF_EXTENT * 0.14;
  const spacing = DIE_HALF_EXTENT * 0.5;
  const surfaceOffset = DIE_HALF_EXTENT * 1.01;

  const pips = [];
  for (const { normal, value } of FACE_NORMALS) {
    const [u, v] = faceTangents(normal);
    for (const [gx, gy] of PIP_LAYOUTS[value]) {
      const x = normal[0] * surfaceOffset + u[0] * gx * spacing + v[0] * gy * spacing;
      const y = normal[1] * surfaceOffset + u[1] * gx * spacing + v[1] * gy * spacing;
      const z = normal[2] * surfaceOffset + u[2] * gx * spacing + v[2] * gy * spacing;
      pips.push([x, y, z]);
    }
  }

  return (
    <>
      {pips.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[pipRadius, 12, 12]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.4} />
        </mesh>
      ))}
    </>
  );
}

/**
 * A physically-simulated die. Imperative API via ref: rollTo(targetValue)
 * resolves the headless search then replays the result on this body.
 */
const Dice = forwardRef(function Dice({ onSettled }, ref) {
  const bodyRef = useRef(null);
  const settleCheckRef = useRef(null);

  const rollTo = useCallback(async (targetValue) => {
    if (!bodyRef.current) return;
    playDiceRattle();
    // The search runs concurrently with (hidden behind) the rattle wind-up
    // -- whichever takes longer gates the actual throw, so a slow search
    // (rare) never looks like a stall and a fast one never feels rushed.
    const minRattle = new Promise((resolve) => setTimeout(resolve, RATTLE_DURATION_MS));
    const [throwParams] = await Promise.all([resolveThrowForTarget(targetValue), minRattle]);
    applyDiceThrow(bodyRef.current, throwParams);
    settleCheckRef.current = { targetValue, stableFrames: 0 };
  }, []);

  const handleCollision = useCallback(() => {
    const body = bodyRef.current;
    if (!body) return;
    const lv = body.linvel();
    const speed = Math.hypot(lv.x, lv.y, lv.z);
    if (speed > 0.05) playDiceLand(Math.min(1, speed / 1.5));
  }, []);

  useImperativeHandle(ref, () => ({ rollTo }), [rollTo]);

  useFrame(() => {
    const check = settleCheckRef.current;
    const body = bodyRef.current;
    if (!check || !body) return;

    const lv = body.linvel();
    const av = body.angvel();
    const speed = Math.hypot(lv.x, lv.y, lv.z) + Math.hypot(av.x, av.y, av.z);
    check.stableFrames = speed < 0.02 ? check.stableFrames + 1 : 0;

    if (check.stableFrames > 15) {
      const settledFace = readSettledFace(body);
      if (settledFace !== check.targetValue) {
        // Dev-only QA signal -- never a gameplay bug, see diceReplay.js.
        console.warn(`[Dice] visible settle (${settledFace}) != target (${check.targetValue}) -- cosmetic only`);
      }
      settleCheckRef.current = null;
      onSettled?.(check.targetValue, settledFace);
    }
  });

  return (
    <RigidBody
      ref={bodyRef}
      colliders={false}
      position={TRAY_WORLD_POSITION}
      friction={DIE_MATERIAL.friction}
      restitution={DIE_MATERIAL.restitution}
      density={DIE_MATERIAL.density}
      onCollisionEnter={handleCollision}
    >
      <CuboidCollider args={[DIE_HALF_EXTENT, DIE_HALF_EXTENT, DIE_HALF_EXTENT]} />
      <mesh castShadow receiveShadow>
        <boxGeometry args={[SIZE, SIZE, SIZE]} />
        <meshPhysicalMaterial color="#f5f2ea" roughness={0.2} metalness={0} clearcoat={0.35} clearcoatRoughness={0.25} />
      </mesh>
      <Pips />
    </RigidBody>
  );
});

export default Dice;
