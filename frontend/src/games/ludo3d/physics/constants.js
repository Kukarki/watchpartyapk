// Single source of truth for both the headless search world and the visible
// rendered world -- they must share identical geometry/material/timestep or
// "same engine, same inputs => same outcome" stops being true.

export const PHYSICS_TIMESTEP = 1 / 60;

export const DIE_HALF_EXTENT = 0.035; // 7cm cube -- larger than a real die, for camera legibility

export const DIE_MATERIAL = { density: 1.0, friction: 0.4, restitution: 0.3 };

// A small walled "dice tray" the die is thrown into -- keeps the die's
// world isolated from the board/pawns (which have no colliders at all) so
// nothing but the tray itself can ever perturb its trajectory, in either
// the headless or the visible world. Flat cuboids only: the cheapest,
// least tunneling-prone contact case, and visual polish (rounded rim)
// lives purely in the mesh, not the collider.
export const TRAY_FLOOR = { halfWidth: 0.21, halfDepth: 0.21, friction: 0.6, restitution: 0.1 };
export const TRAY_WALL = { height: 0.06, thickness: 0.02, friction: 0.3, restitution: 0.4 };
// The dice tray now lives in its own dedicated on-screen panel/scene (see
// components/hud/DicePanel.jsx), not next to the board in-world -- so its
// world origin is just the panel's own origin, no board edge to clear.
export const TRAY_WORLD_POSITION = [0, 0, 0];

export const SPAWN = {
  jitterXZ: 0.12,
  heightRange: [0.22, 0.35],
};

export const THROW_VELOCITY = {
  linXZRange: [-0.35, 0.35],
  linYRange: [-1.4, -0.6],
  angMax: 18,
};

export const SEARCH_LIMITS = {
  maxAttempts: 40,           // (5/6)^40 =~ 0.05% chance of exhaustion
  maxStepsPerAttempt: 150,   // 150 steps @ 1/60s = 2.5 simulated seconds
  yieldEveryNAttempts: 2,    // keeps the search from stalling the main thread
};
