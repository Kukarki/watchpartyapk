// Standard die convention: opposite faces sum to 7. This table is the
// single source of truth for both the visual pip layout (components/scene/
// Dice.jsx) and reading which face landed "up" after a throw settles.
export const FACE_NORMALS = [
  { normal: [1, 0, 0], value: 3 },
  { normal: [-1, 0, 0], value: 4 },
  { normal: [0, 1, 0], value: 1 },
  { normal: [0, -1, 0], value: 6 },
  { normal: [0, 0, 1], value: 2 },
  { normal: [0, 0, -1], value: 5 },
];

// Rotates a local-space vector by a quaternion {x,y,z,w} -> world-space vector.
function rotateVector(q, [vx, vy, vz]) {
  const { x: qx, y: qy, z: qz, w: qw } = q;
  const tx = 2 * (qy * vz - qz * vy);
  const ty = 2 * (qz * vx - qx * vz);
  const tz = 2 * (qx * vy - qy * vx);
  return [
    vx + qw * tx + (qy * tz - qz * ty),
    vy + qw * ty + (qz * tx - qx * tz),
    vz + qw * tz + (qx * ty - qy * tx),
  ];
}

/**
 * Which pip value is currently facing up, given the die's world rotation.
 * @param {{x:number,y:number,z:number,w:number}} quat
 * @returns {1|2|3|4|5|6}
 */
export function readUpFace(quat) {
  let bestValue = FACE_NORMALS[0].value;
  let bestDot = -Infinity;
  for (const face of FACE_NORMALS) {
    const [, worldY] = rotateVector(quat, face.normal); // dot with world-up [0,1,0] is just the Y component
    if (worldY > bestDot) {
      bestDot = worldY;
      bestValue = face.value;
    }
  }
  return bestValue;
}
