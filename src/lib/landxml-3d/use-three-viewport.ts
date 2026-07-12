/**
 * use-three-viewport — boilerplate compartilhado de viewport Three.js:
 * WebGLRenderer + PerspectiveCamera + OrbitControls + raf loop + resize.
 * A cena ativa entra por ref (setScene) — o loop renderiza o que estiver lá.
 */
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export interface ThreeViewport {
  containerRef: React.RefObject<HTMLDivElement | null>;
  cameraRef: React.RefObject<THREE.PerspectiveCamera | null>;
  controlsRef: React.RefObject<OrbitControls | null>;
  rendererRef: React.RefObject<THREE.WebGLRenderer | null>;
  sceneRef: React.RefObject<THREE.Scene | null>;
}

export function useThreeViewport(): ThreeViewport {
  const containerRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / Math.max(container.clientHeight, 1),
      0.1,
      100000,
    );
    camera.position.set(0, 100, 100);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI - 0.1;
    controlsRef.current = controls;

    const animate = () => {
      controls.update();
      const scene = sceneRef.current;
      if (scene) renderer.render(scene, camera);
      else renderer.clearColor();
      rafRef.current = requestAnimationFrame(animate);
    };
    animate();

    const resize = () => {
      const w = container.clientWidth;
      const h = Math.max(container.clientHeight, 1);
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    return () => {
      cancelAnimationFrame(rafRef.current);
      observer.disconnect();
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return { containerRef, cameraRef, controlsRef, rendererRef, sceneRef };
}
