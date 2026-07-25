// Web port of the Expo app's AvatarStage (avatar/three/AvatarStage.jsx).
// Same imperative API and visual design (framings, Beam key light, gradient
// backdrop, orbit + pinch-zoom), rebuilt on a plain <canvas> + WebGLRenderer
// instead of expo-gl/expo-three, and Pointer Events instead of PanResponder.
//
//   ref.current.setFraming('face')
//   ref.current.playEmote('wave')
//   ref.current.setExpression('grin')
//   ref.current.snapshot() -> dataURL string
import {
  forwardRef, useCallback, useEffect, useImperativeHandle, useRef,
} from 'react';
import * as THREE from 'three';
import { buildAvatar } from '@/lib/avatar/buildAvatar.js';

const FRAMINGS = {
  full: { target: [0, 0.92, 0], dist: 3.3, fov: 32 },
  bust: { target: [0, 1.45, 0], dist: 1.9, fov: 30 },
  head: { target: [0, 1.72, 0], dist: 1.05, fov: 28 },
  face: { target: [0, 1.7, 0], dist: 0.9, fov: 26 },
};

function bgColors(recipe, catalogIndex) {
  const item = recipe && recipe.background ? catalogIndex.get(recipe.background) : null;
  const c = item && Array.isArray(item.colorways) && item.colorways[0];
  return {
    top: (c && c.primary) || '#141826',
    bottom: (c && c.secondary) || '#0B0D14',
  };
}

const AvatarStage = forwardRef(function AvatarStage(
  { recipe, catalogIndex = new Map(), framing = 'full', autoRotate = true, className = '' },
  ref,
) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const state = useRef({
    renderer: null, scene: null, camera: null,
    avatar: null, backdrop: null, floor: null,
    yaw: 0, yawVel: 0, dist: FRAMINGS[framing].dist, distTarget: FRAMINGS[framing].dist,
    framing: FRAMINGS[framing], lastTouch: 0, raf: 0, running: false,
    clock: new THREE.Clock(),
  }).current;

  const recipeRef = useRef(recipe);
  recipeRef.current = recipe;
  const indexRef = useRef(catalogIndex);
  indexRef.current = catalogIndex;

  // ---- rebuild the avatar whenever the recipe changes ----------------------
  const rebuild = useCallback(() => {
    const s = state;
    if (!s.scene || !recipeRef.current) return;
    if (s.avatar) {
      s.scene.remove(s.avatar.group);
      s.avatar.dispose();
      s.avatar = null;
    }
    s.avatar = buildAvatar(recipeRef.current, indexRef.current);
    s.scene.add(s.avatar.group);

    const { top, bottom } = bgColors(recipeRef.current, indexRef.current);
    if (s.scene.background) s.scene.background.set(bottom);
    if (s.backdrop) s.backdrop.material.color.set(top);
    if (s.floor) s.floor.material.color.set(top);
  }, [state]);

  useEffect(() => { rebuild(); }, [recipe, catalogIndex, rebuild]);

  useEffect(() => {
    state.framing = FRAMINGS[framing] || FRAMINGS.full;
    state.distTarget = state.framing.dist;
  }, [framing, state]);

  // ---- pointer gestures: 1-pointer orbit, wheel/pinch zoom ------------------
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const active = new Map(); // pointerId -> {x, y}
    let dragLast = null;
    let pinchStartDist = 0;

    const dist2 = () => {
      const pts = [...active.values()];
      return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    };

    const onPointerDown = (e) => {
      el.setPointerCapture(e.pointerId);
      active.set(e.pointerId, { x: e.clientX, y: e.clientY });
      state.lastTouch = Date.now();
      if (active.size === 1) dragLast = { x: e.clientX, y: e.clientY };
      if (active.size === 2) pinchStartDist = dist2();
    };
    const onPointerMove = (e) => {
      if (!active.has(e.pointerId)) return;
      active.set(e.pointerId, { x: e.clientX, y: e.clientY });
      state.lastTouch = Date.now();

      if (active.size === 2) {
        const d = dist2();
        if (pinchStartDist > 0) {
          state.distTarget = Math.min(4.4, Math.max(0.7, state.distTarget * (pinchStartDist / d)));
          pinchStartDist = d;
        }
      } else if (active.size === 1 && dragLast) {
        const dx = e.clientX - dragLast.x;
        state.yawVel = dx * 0.0015;
        state.yaw += dx * 0.0045;
        dragLast = { x: e.clientX, y: e.clientY };
      }
    };
    const onPointerUp = (e) => {
      active.delete(e.pointerId);
      pinchStartDist = 0;
      dragLast = active.size === 1 ? [...active.values()][0] : null;
    };
    const onWheel = (e) => {
      e.preventDefault();
      state.lastTouch = Date.now();
      state.distTarget = Math.min(4.4, Math.max(0.7, state.distTarget * (1 + e.deltaY * 0.001)));
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
      el.removeEventListener('wheel', onWheel);
    };
  }, [state]);

  // ---- renderer / scene setup ------------------------------------------------
  useEffect(() => {
    const s = state;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    s.renderer = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0B0D14');
    s.scene = scene;

    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 30);
    s.camera = camera;

    // Projector Noir lighting: the Beam (violet key), cyan rim, soft fill
    scene.add(new THREE.AmbientLight('#6E7699', 0.55));
    const beam = new THREE.SpotLight('#B7A8FF', 950, 14, Math.PI / 5, 0.5, 2);
    beam.position.set(-1.6, 3.4, 2.2);
    scene.add(beam);
    const rim = new THREE.DirectionalLight('#35E0D0', 0.7);
    rim.position.set(1.6, 2.0, -2.4);
    scene.add(rim);
    const fill = new THREE.DirectionalLight('#DDE6FF', 0.5);
    fill.position.set(0.8, 1.2, 2.6);
    scene.add(fill);

    // backdrop plane + floor disc take the background item's colors
    const backdrop = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 10),
      new THREE.MeshBasicMaterial({ color: '#141826' }),
    );
    backdrop.position.set(0, 2.4, -4.5);
    scene.add(backdrop);
    s.backdrop = backdrop;

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(1.15, 48),
      new THREE.MeshStandardMaterial({ color: '#141826', roughness: 0.9 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.001;
    scene.add(floor);
    s.floor = floor;

    const resize = () => {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    rebuild();
    s.clock.start();
    s.running = true;

    const loop = () => {
      if (!s.running) return;
      s.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, s.clock.getDelta());
      const t = s.clock.elapsedTime;

      // idle autorotate after 2.5 s of no touch
      if (autoRotate && Date.now() - s.lastTouch > 2500) s.yaw += dt * 0.25;
      s.yaw += s.yawVel; s.yawVel *= 0.9;

      if (s.avatar) {
        s.avatar.group.rotation.y = s.yaw;
        s.avatar.update(t, dt);
      }

      // spring the camera toward the current framing
      s.dist += (s.distTarget - s.dist) * Math.min(1, dt * 7);
      const f = s.framing;
      const ty = f.target[1];
      camera.position.set(0, ty + 0.12, s.dist);
      camera.lookAt(f.target[0], ty, f.target[2]);
      camera.fov += (f.fov - camera.fov) * Math.min(1, dt * 7);
      camera.updateProjectionMatrix();

      renderer.render(scene, camera);
    };
    loop();

    return () => { // unmount: stop loop + free GPU memory
      s.running = false;
      if (s.raf) cancelAnimationFrame(s.raf);
      ro.disconnect();
      if (s.avatar) s.avatar.dispose();
      renderer.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- imperative api ------------------------------------------------------------
  useImperativeHandle(ref, () => ({
    setFraming(name) {
      state.framing = FRAMINGS[name] || FRAMINGS.full;
      state.distTarget = state.framing.dist;
    },
    setYaw(y) { state.yaw = y; state.yawVel = 0; },
    playEmote(name) { if (state.avatar) state.avatar.playEmote(name); },
    setExpression(id) { if (state.avatar) state.avatar.setExpression(id); },
    snapshot() {
      if (!canvasRef.current) return null;
      return canvasRef.current.toDataURL('image/png');
    },
  }), [state]);

  return (
    <div ref={containerRef} className={`relative w-full h-full overflow-hidden touch-none ${className}`}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
});

export default AvatarStage;
