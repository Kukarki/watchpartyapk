import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin } from '@pixiv/three-vrm';

// Loads and renders a single .vrm model in a self-sized canvas. Sizing
// follows the same ResizeObserver-measures-container pattern used
// elsewhere in this app for responsive canvases (e.g. the Ludo board),
// rather than relying on CSS to size a <canvas> correctly.
export default function VrmViewer({ vrmUrl }) {
  const containerRef = useRef(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!vrmUrl) return;
    const container = containerRef.current;
    if (!container) return;

    let renderer, camera, scene, vrm, frameId;
    let disposed = false;

    const width = () => container.clientWidth || 320;
    const height = () => container.clientHeight || 320;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(30, width() / height(), 0.1, 20);
    camera.position.set(0, 1.3, 2.2);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width(), height());
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    const dir = new THREE.DirectionalLight(0xffffff, 1.5);
    dir.position.set(1, 1, 1);
    scene.add(dir);

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));
    loader.load(
      vrmUrl,
      (gltf) => {
        if (disposed) return;
        vrm = gltf.userData.vrm;
        scene.add(vrm.scene);
        vrm.scene.rotation.y = Math.PI; // VRM models face +Z by convention; flip to face the camera
        camera.lookAt(0, 1.3, 0);
        setLoading(false);
      },
      undefined,
      (err) => {
        if (disposed) return;
        console.error('[VrmViewer] load failed', err);
        setError("Couldn't load this avatar model.");
        setLoading(false);
      }
    );

    const clock = new THREE.Clock();
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      if (vrm) {
        vrm.update(delta);
        vrm.scene.rotation.y += delta * 0.4; // slow auto-rotate showcase spin
      }
      renderer.render(scene, camera);
    };
    animate();

    const ro = new ResizeObserver(() => {
      if (!renderer) return;
      renderer.setSize(width(), height());
      camera.aspect = width() / height();
      camera.updateProjectionMatrix();
    });
    ro.observe(container);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      ro.disconnect();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [vrmUrl]);

  if (!vrmUrl) return null;

  return (
    <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-void border border-border">
      <div ref={containerRef} className="w-full h-full" />
      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center text-dim text-xs">
          Loading 3D avatar…
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-danger text-xs px-4 text-center">
          {error}
        </div>
      )}
    </div>
  );
}
