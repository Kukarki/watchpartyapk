import { forwardRef, useRef, useImperativeHandle } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { tokenCell } from '@/components/games/board-layout.js';
import { gridToWorld, BOARD_SURFACE_Y } from './boardTransform.js';

const HOP_DURATION = 0.22;
const HOP_ARC_HEIGHT = 0.045;
const TUMBLE_DURATION = 0.5;
const BASE_RADIUS = 0.028;
const BASE_HEIGHT = 0.02;
const DOME_RADIUS = 0.02;

function easeOutQuad(t) {
  return t * (2 - t);
}

function posToWorld(color, pos, tokenIndex) {
  const cell = tokenCell(color, pos, tokenIndex);
  return gridToWorld(cell, BOARD_SURFACE_Y + 0.003);
}

/**
 * A single Ludo pawn. Purely a rendering + animation layer -- it never
 * reads or mutates game state itself. The controller (useLudo3DStore.js)
 * drives it imperatively via ref: hopTo(path) walks it cell-by-cell with an
 * arc + easing per hop (own-token moves); tumbleHome() plays a knocked-off
 * fling back to base (opponent captures). Both return a Promise that
 * resolves when the animation finishes, so the controller can sequence
 * events in order instead of firing them all at once.
 */
const Pawn = forwardRef(function Pawn({ color, colorHex, tokenIndex, initialPos, isHighlighted, onClick }, ref) {
  const groupRef = useRef(null);
  const animRef = useRef(null);
  const currentPosRef = useRef(initialPos);
  const mountedRef = useRef(false);
  const ringRef = useRef(null);

  const hopTo = (path) =>
    new Promise((resolve) => {
      animRef.current = { type: 'hop', queue: path.map((pos) => ({ pos })), current: null, resolve };
    });

  const tumbleHome = () =>
    new Promise((resolve) => {
      animRef.current = { type: 'tumble', queue: [{ pos: 'home' }], current: null, resolve };
    });

  useImperativeHandle(ref, () => ({ hopTo, tumbleHome }), []); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;

    if (!mountedRef.current) {
      const [x, y, z] = posToWorld(color, currentPosRef.current, tokenIndex);
      group.position.set(x, y, z);
      mountedRef.current = true;
    }

    const anim = animRef.current;
    if (!anim) return;

    if (!anim.current) {
      if (anim.queue.length === 0) {
        const { resolve } = anim;
        animRef.current = null;
        resolve();
        return;
      }
      const next = anim.queue.shift();
      anim.current = {
        fromWorld: group.position.toArray(),
        toWorld: posToWorld(color, next.pos, tokenIndex),
        elapsed: 0,
        duration: anim.type === 'tumble' ? TUMBLE_DURATION : HOP_DURATION,
      };
      currentPosRef.current = next.pos;
    }

    const c = anim.current;
    c.elapsed += delta;
    const t = Math.min(1, c.elapsed / c.duration);
    const eased = easeOutQuad(t);

    const x = THREE.MathUtils.lerp(c.fromWorld[0], c.toWorld[0], eased);
    const z = THREE.MathUtils.lerp(c.fromWorld[2], c.toWorld[2], eased);
    const baseY = THREE.MathUtils.lerp(c.fromWorld[1], c.toWorld[1], eased);
    const arc = anim.type === 'hop' ? Math.sin(Math.min(1, t) * Math.PI) * HOP_ARC_HEIGHT : 0;
    group.position.set(x, baseY + arc, z);

    if (anim.type === 'tumble') {
      group.rotation.x = eased * Math.PI * 2.4;
      group.rotation.z = eased * Math.PI * 1.4;
    }

    if (t >= 1) {
      const finishedType = anim.type;
      anim.current = null;
      if (finishedType === 'tumble') {
        group.rotation.set(0, 0, 0);
      } else {
        // Small landing-bounce squash on each hop's arrival, eased back below.
        group.scale.set(1.08, 0.85, 1.08);
      }
    }

    // Ease any squash-bounce back to normal scale.
    if (group.scale.x !== 1) {
      group.scale.lerp(new THREE.Vector3(1, 1, 1), Math.min(1, delta * 10));
    }

    // Blink the legal-move ring so movable tokens actually pop instead of
    // sitting there as a static outline.
    if (isHighlighted && ringRef.current) {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 1000 * 5.5);
      ringRef.current.material.emissiveIntensity = 0.5 + pulse * 1.5;
      ringRef.current.material.opacity = 0.55 + pulse * 0.45;
      const s = 1 + pulse * 0.25;
      ringRef.current.scale.set(s, s, 1);
    }
  });

  return (
    <group ref={groupRef} onClick={onClick}>
      <mesh castShadow receiveShadow position={[0, BASE_HEIGHT / 2, 0]}>
        <cylinderGeometry args={[BASE_RADIUS, BASE_RADIUS * 1.15, BASE_HEIGHT, 32]} />
        <meshPhysicalMaterial color={colorHex} roughness={0.22} metalness={0} clearcoat={0.4} clearcoatRoughness={0.2} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, BASE_HEIGHT + DOME_RADIUS * 0.85, 0]}>
        <sphereGeometry args={[DOME_RADIUS, 32, 24]} />
        <meshPhysicalMaterial color={colorHex} roughness={0.18} metalness={0} clearcoat={0.5} clearcoatRoughness={0.15} />
      </mesh>
      {isHighlighted && (
        <mesh ref={ringRef} position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[BASE_RADIUS * 1.3, BASE_RADIUS * 1.6, 24]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive="#ffffff"
            emissiveIntensity={0.6}
            transparent
            opacity={0.8}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  );
});

export default Pawn;
