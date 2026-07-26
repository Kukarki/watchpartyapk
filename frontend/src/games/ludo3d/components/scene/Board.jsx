import { useMemo } from 'react';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import {
  TRACK, HOME_STRETCH, SAFE_GLOBAL_SQUARES, BASE_TOP_LEFT,
  COLOR_START_OFFSET, TOKEN_SLOT_OFFSETS,
} from '@/components/games/board-layout.js';
import { COLOR_HEX } from '../../engine/colors.js';
import { gridToWorld, CELL_SIZE, BOARD_SURFACE_Y, BOARD_HALF_EXTENT } from './boardTransform.js';
import { getFeltColorTexture, getFeltRoughnessTexture, getWoodColorTexture } from './proceduralTextures.js';

const CELL = CELL_SIZE * 0.92; // small gap between cells for a visible grid
const CELL_HEIGHT = 0.006;
const CREAM = '#e9e0c9';
const START_INDICES = new Set(Object.values(COLOR_START_OFFSET));
const CENTER_Y = BOARD_SURFACE_Y + CELL_HEIGHT / 2;

function buildStarShape(outerRadius, innerRadius, points = 5) {
  const shape = new THREE.Shape();
  const step = Math.PI / points;
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = i * step - Math.PI / 2;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

function Cell({ rowCol, color, raised = false }) {
  const [x, , z] = gridToWorld(rowCol);
  const y = raised ? CENTER_Y + 0.002 : CENTER_Y;
  const map = useMemo(() => getFeltColorTexture(color), [color]);
  const roughnessMap = useMemo(() => getFeltRoughnessTexture(), []);
  return (
    <mesh position={[x, y, z]} receiveShadow castShadow>
      <boxGeometry args={[CELL, CELL_HEIGHT, CELL]} />
      <meshStandardMaterial map={map} roughnessMap={roughnessMap} roughness={0.85} metalness={0} />
    </mesh>
  );
}

// A dark disc backing behind a marker so it stays legible regardless of
// whatever color/texture the cell underneath happens to be -- a marker in
// a color close to the cell's own tone (white-on-cream, or a color arrow
// on that same color's own cell) was nearly invisible before.
function MarkerBacking({ radius }) {
  return (
    <mesh position={[0, -0.0005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[radius, 20]} />
      <meshStandardMaterial color="#241a10" roughness={0.6} side={THREE.DoubleSide} />
    </mesh>
  );
}

function StarMarker({ rowCol }) {
  const [x, , z] = gridToWorld(rowCol);
  const shape = useMemo(() => buildStarShape(CELL_SIZE * 0.26, CELL_SIZE * 0.11), []);
  return (
    <group position={[x, CENTER_Y + 0.005, z]}>
      <MarkerBacking radius={CELL_SIZE * 0.32} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0006, 0]}>
        <shapeGeometry args={[shape]} />
        <meshStandardMaterial
          color="#f7c948"
          emissive="#f7c948"
          emissiveIntensity={0.25}
          roughness={0.35}
          metalness={0.25}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

// A small triangular arrow at each color's start cell, pointing along the
// track's direction of travel. Deliberately NOT tinted to the cell's own
// color (that made it invisible) -- white with a dark backing reads
// clearly against all four player colors.
function StartArrow({ rowCol, direction }) {
  const [x, , z] = gridToWorld(rowCol);
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    const w = CELL_SIZE * 0.24, h = CELL_SIZE * 0.32;
    s.moveTo(0, h / 2);
    s.lineTo(-w / 2, -h / 2);
    s.lineTo(w / 2, -h / 2);
    s.closePath();
    return s;
  }, []);
  return (
    <group position={[x, CENTER_Y + 0.005, z]} rotation={[0, direction, 0]}>
      <MarkerBacking radius={CELL_SIZE * 0.34} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0006, 0]}>
        <shapeGeometry args={[shape]} />
        <meshStandardMaterial color="#ffffff" roughness={0.4} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function HomeBase({ color }) {
  const [baseRow, baseCol] = BASE_TOP_LEFT[color];
  // Center of the 6x6 base block, in grid space (baseRow+2.5, baseCol+2.5).
  const [cx, , cz] = gridToWorld([baseRow + 2.5, baseCol + 2.5]);
  const outerSize = CELL_SIZE * 6 - CELL_SIZE * 0.15;
  const innerSize = CELL_SIZE * 4.3;
  const outerMap = useMemo(() => getFeltColorTexture(COLOR_HEX[color], { repeat: 5 }), [color]);
  const innerMap = useMemo(() => getFeltColorTexture(CREAM, { repeat: 4 }), []);
  const roughnessMap = useMemo(() => getFeltRoughnessTexture(), []);

  return (
    <group>
      <mesh position={[cx, CENTER_Y, cz]} receiveShadow>
        <boxGeometry args={[outerSize, CELL_HEIGHT, outerSize]} />
        <meshStandardMaterial map={outerMap} roughnessMap={roughnessMap} roughness={0.8} />
      </mesh>
      <mesh position={[cx, CENTER_Y + 0.003, cz]} receiveShadow>
        <boxGeometry args={[innerSize, CELL_HEIGHT, innerSize]} />
        <meshStandardMaterial map={innerMap} roughnessMap={roughnessMap} roughness={0.8} />
      </mesh>
      {TOKEN_SLOT_OFFSETS.map(([dr, dc], i) => {
        const [px, , pz] = gridToWorld([baseRow + dr, baseCol + dc]);
        return (
          <mesh key={i} position={[px, CENTER_Y + 0.006, pz]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[CELL_SIZE * 0.28, CELL_SIZE * 0.34, 24]} />
            <meshStandardMaterial color={COLOR_HEX[color]} roughness={0.35} metalness={0.7} side={THREE.DoubleSide} />
          </mesh>
        );
      })}
    </group>
  );
}

// The 4 colored finish triangles meeting at CENTER -- one per home-stretch
// direction (verified against HOME_STRETCH's row/col progression: red
// enters from the low-col side (left), green from the low-row side (top),
// yellow from the high-col side (right), blue from the high-row side
// (bottom)).
function CenterTriangles() {
  const [midX, , midZ] = gridToWorld([7, 7]);
  const corner = (row, col) => {
    const [x, , z] = gridToWorld([row, col]);
    return [x - midX, z - midZ];
  };
  const tl = corner(5.5, 5.5);
  const tr = corner(5.5, 8.5);
  const br = corner(8.5, 8.5);
  const bl = corner(8.5, 5.5);
  const mid = [0, 0];

  const triangles = [
    { color: COLOR_HEX.green, pts: [tl, tr, mid] },   // top
    { color: COLOR_HEX.yellow, pts: [tr, br, mid] },  // right
    { color: COLOR_HEX.blue, pts: [br, bl, mid] },    // bottom
    { color: COLOR_HEX.red, pts: [bl, tl, mid] },     // left
  ];

  return (
    <group position={[midX, CENTER_Y + 0.004, midZ]}>
      {triangles.map(({ color, pts }, i) => {
        const shape = new THREE.Shape();
        shape.moveTo(pts[0][0], pts[0][1]);
        shape.lineTo(pts[1][0], pts[1][1]);
        shape.lineTo(pts[2][0], pts[2][1]);
        shape.closePath();
        return (
          <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <shapeGeometry args={[shape]} />
            <meshStandardMaterial color={color} roughness={0.4} metalness={0.15} side={THREE.DoubleSide} />
          </mesh>
        );
      })}
    </group>
  );
}

export default function Board() {
  const safeIndicesNotStart = SAFE_GLOBAL_SQUARES.filter((i) => !START_INDICES.has(i));
  // Arrow direction (radians, around Y) roughly facing the next square in
  // each color's own arm -- a small aesthetic touch, not gameplay-critical.
  const ARROW_DIR = { red: 0, green: Math.PI / 2, yellow: Math.PI, blue: -Math.PI / 2 };
  const woodMap = useMemo(() => getWoodColorTexture('#5b3a24'), []);
  const topMap = useMemo(() => getFeltColorTexture(CREAM, { repeat: 8 }), []);
  const topRoughnessMap = useMemo(() => getFeltRoughnessTexture(), []);

  return (
    <group>
      {/* Base slab -- felt/wood, thickness + a beveled rim */}
      <RoundedBox
        args={[BOARD_HALF_EXTENT * 2 + 0.1, 0.03, BOARD_HALF_EXTENT * 2 + 0.1]}
        radius={0.015}
        smoothness={4}
        position={[0, -0.015, 0]}
        receiveShadow
        castShadow
      >
        <meshStandardMaterial map={woodMap} roughness={0.6} metalness={0} />
      </RoundedBox>
      <mesh position={[0, 0, 0]} receiveShadow>
        <boxGeometry args={[BOARD_HALF_EXTENT * 2 + 0.02, 0.006, BOARD_HALF_EXTENT * 2 + 0.02]} />
        <meshStandardMaterial map={topMap} roughnessMap={topRoughnessMap} roughness={0.85} metalness={0} />
      </mesh>

      {/* 4 home base corners */}
      {Object.keys(BASE_TOP_LEFT).map((color) => (
        <HomeBase key={color} color={color} />
      ))}

      {/* 52-cell shared track */}
      {TRACK.map((rowCol, i) => (
        <Cell
          key={`track-${i}`}
          rowCol={rowCol}
          color={START_INDICES.has(i)
            ? COLOR_HEX[Object.keys(COLOR_START_OFFSET).find((c) => COLOR_START_OFFSET[c] === i)]
            : CREAM}
        />
      ))}

      {/* Per-color home stretch (3-6 cells leading into the center) */}
      {Object.entries(HOME_STRETCH).map(([color, cells]) =>
        cells.map((rowCol, i) => (
          <Cell key={`${color}-stretch-${i}`} rowCol={rowCol} color={COLOR_HEX[color]} />
        ))
      )}

      {/* Star markers on the non-start safe cells */}
      {safeIndicesNotStart.map((i) => (
        <StarMarker key={`star-${i}`} rowCol={TRACK[i]} />
      ))}

      {/* Entry arrows on each color's start cell */}
      {Object.entries(COLOR_START_OFFSET).map(([color, i]) => (
        <StartArrow key={`arrow-${color}`} rowCol={TRACK[i]} direction={ARROW_DIR[color]} />
      ))}

      <CenterTriangles />
    </group>
  );
}
