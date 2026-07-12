import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { LandXmlSceneData, LandXmlSurface3D } from "./types";

/* ── Color gradient by elevation ──────────────────────────── */

const STOPS: [number, [number, number, number]][] = [
  [0.0, [0x1e / 255, 0x40 / 255, 0xaf / 255]], // blue-700
  [0.25, [0x10 / 255, 0xb9 / 255, 0x81 / 255]], // emerald-500
  [0.5, [0xfa / 255, 0xcc / 255, 0x15 / 255]], // yellow-400
  [0.75, [0xf9 / 255, 0x73 / 255, 0x16 / 255]], // orange-500
  [1.0, [0xdc / 255, 0x26 / 255, 0x26 / 255]], // red-600
];

function elevColor(t: number): [number, number, number] {
  for (let i = 0; i < STOPS.length - 1; i++) {
    const [a, ca] = STOPS[i];
    const [b, cb] = STOPS[i + 1];
    if (t >= a && t <= b) {
      const u = (t - a) / Math.max(b - a, 1e-9);
      return [
        ca[0] + (cb[0] - ca[0]) * u,
        ca[1] + (cb[1] - ca[1]) * u,
        ca[2] + (cb[2] - ca[2]) * u,
      ];
    }
  }
  return STOPS[STOPS.length - 1][1];
}

/* ── Surface mesh ─────────────────────────────────────────── */

export function buildSurfaceMesh(surf: LandXmlSurface3D): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(surf.points);
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(surf.faces), 1));

  // Vertex colors from elevation. Each vertex = positions[i*3+1] (Y in Three.js).
  const nVerts = positions.length / 3;
  const colors = new Float32Array(nVerts * 3);
  // Y coord = z_landxml - cZ; bring back to original elev range from elev_min/max.
  // We computed colors against the original elev (Y stored = z - cZ), so we
  // need cZ — derive from the offset baked in. Easier: normalize by the Y
  // component itself within the surface's own min/max (re-compute here).
  let yMin = Infinity;
  let yMax = -Infinity;
  for (let i = 0; i < nVerts; i++) {
    const y = positions[i * 3 + 1];
    if (y < yMin) yMin = y;
    if (y > yMax) yMax = y;
  }
  const yRange = Math.max(yMax - yMin, 1e-9);
  for (let i = 0; i < nVerts; i++) {
    const y = positions[i * 3 + 1];
    const t = (y - yMin) / yRange;
    const [r, g, b] = elevColor(t);
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const material = new THREE.MeshLambertMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    flatShading: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData = { kind: "surface", name: surf.name };
  return mesh;
}

/* ── Alignment lines ──────────────────────────────────────── */

export function buildAlignmentLine(
  name: string,
  polyline3d: number[],
  color = 0x06b6d4,
): THREE.Line {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(polyline3d), 3),
  );
  const material = new THREE.LineBasicMaterial({ color, linewidth: 2 });
  const line = new THREE.Line(geometry, material);
  line.userData = { kind: "alignment", name };
  return line;
}

/* ── Camera fit-to-extents ────────────────────────────────── */

export function fitCameraToBox(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  box: { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number },
): void {
  const cx = (box.minX + box.maxX) / 2;
  const cy = (box.minY + box.maxY) / 2;
  const cz = (box.minZ + box.maxZ) / 2;
  const sx = box.maxX - box.minX;
  const sy = box.maxY - box.minY;
  const sz = box.maxZ - box.minZ;
  const radius = Math.max(sx, sy, sz, 1) * 0.6;
  const fov = (camera.fov * Math.PI) / 180;
  const dist = radius / Math.sin(fov / 2);
  camera.position.set(cx + dist * 0.7, cy + radius * 1.2, cz + dist * 0.7);
  controls.target.set(cx, cy, cz);
  camera.near = Math.max(dist / 1000, 0.1);
  camera.far = dist * 10;
  camera.updateProjectionMatrix();
  controls.update();
}

/* ── Scene assembly ───────────────────────────────────────── */

export interface BuiltScene {
  scene: THREE.Scene;
  surfaceMeshes: THREE.Mesh[];
  alignmentLines: THREE.Line[];
}

export function buildScene(data: LandXmlSceneData): BuiltScene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0f172a); // slate-900

  const ambient = new THREE.AmbientLight(0xffffff, 0.45);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffffff, 0.85);
  sun.position.set(1, 1.5, 1);
  scene.add(sun);

  const surfaceMeshes: THREE.Mesh[] = [];
  for (const surf of data.surfaces) {
    if (surf.points.length === 0 || surf.faces.length === 0) continue;
    const mesh = buildSurfaceMesh(surf);
    scene.add(mesh);
    surfaceMeshes.push(mesh);
  }

  const alignmentLines: THREE.Line[] = [];
  for (const al of data.alignments) {
    if (al.polyline_3d.length < 6) continue;
    const line = buildAlignmentLine(al.name, al.polyline_3d);
    scene.add(line);
    alignmentLines.push(line);
  }

  return { scene, surfaceMeshes, alignmentLines };
}

export function disposeScene(built: BuiltScene): void {
  for (const mesh of built.surfaceMeshes) {
    mesh.geometry.dispose();
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((m) => m.dispose());
    } else {
      mesh.material.dispose();
    }
  }
  for (const line of built.alignmentLines) {
    line.geometry.dispose();
    if (Array.isArray(line.material)) {
      line.material.forEach((m) => m.dispose());
    } else {
      line.material.dispose();
    }
  }
}
