import { TRAY_WORLD_POSITION, TRAY_FLOOR, TRAY_WALL } from './constants.js';

const [tx, ty, tz] = TRAY_WORLD_POSITION;

/**
 * Plain-data collider specs for the dice tray -- consumed imperatively by
 * the headless search world (buildHeadlessTrayColliders) and declaratively
 * by the visible R3F scene (components/scene/DiceTray.jsx), so both worlds
 * are built from exactly the same numbers.
 */
export function getTrayColliderSpecs() {
  const { halfWidth, halfDepth, friction: floorFriction, restitution: floorRestitution } = TRAY_FLOOR;
  const { height: wallHeight, thickness: wallThickness, friction: wallFriction, restitution: wallRestitution } = TRAY_WALL;
  const floorY = ty;
  const wallY = floorY + wallHeight / 2;
  const wall = { friction: wallFriction, restitution: wallRestitution };

  return [
    { name: 'floor', halfExtents: [halfWidth, 0.005, halfDepth], position: [tx, floorY, tz], friction: floorFriction, restitution: floorRestitution },
    { name: 'wall-north', halfExtents: [halfWidth, wallHeight / 2, wallThickness / 2], position: [tx, wallY, tz - halfDepth], ...wall },
    { name: 'wall-south', halfExtents: [halfWidth, wallHeight / 2, wallThickness / 2], position: [tx, wallY, tz + halfDepth], ...wall },
    { name: 'wall-east', halfExtents: [wallThickness / 2, wallHeight / 2, halfDepth], position: [tx + halfWidth, wallY, tz], ...wall },
    { name: 'wall-west', halfExtents: [wallThickness / 2, wallHeight / 2, halfDepth], position: [tx - halfWidth, wallY, tz], ...wall },
  ];
}

/** Builds the same tray as static colliders directly in a raw Rapier World (headless use only). */
export function buildHeadlessTrayColliders(RAPIER, world) {
  for (const spec of getTrayColliderSpecs()) {
    const desc = RAPIER.ColliderDesc.cuboid(...spec.halfExtents)
      .setTranslation(...spec.position)
      .setFriction(spec.friction)
      .setRestitution(spec.restitution);
    world.createCollider(desc);
  }
}
