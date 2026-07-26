import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { getTrayColliderSpecs } from '../../physics/diceTray.js';

// Built from the exact same collider specs as the headless search world
// (physics/diceTray.js) -- both worlds share identical geometry.
export default function DiceTray() {
  return (
    <group>
      {getTrayColliderSpecs().map((spec) => (
        <RigidBody
          key={spec.name}
          type="fixed"
          colliders={false}
          position={spec.position}
          friction={spec.friction}
          restitution={spec.restitution}
        >
          <CuboidCollider args={spec.halfExtents} />
          <mesh receiveShadow castShadow={spec.name !== 'floor'}>
            <boxGeometry args={spec.halfExtents.map((h) => h * 2)} />
            <meshStandardMaterial
              color={spec.name === 'floor' ? '#4a3320' : '#2e2013'}
              roughness={0.85}
              metalness={0}
            />
          </mesh>
        </RigidBody>
      ))}
    </group>
  );
}
