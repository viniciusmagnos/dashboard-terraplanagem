/**
 * corridor-scene — cena 3D do corredor a partir do bloco `geometria` do
 * pacote v2 (client-side, sem backend).
 *
 * Convenção idêntica ao scene3d.py/scene-builder.ts: mundo (E, N, Z) →
 * Three.js Y-up (x=E, y=Z, z=−N); os offsets de precisão (world_offset /
 * z_offset_m) JÁ vêm aplicados no pacote.
 *
 * Camadas construídas (grupos toggláveis):
 * - terreno: fita triangulada entre as linhas de terreno de seções
 *   consecutivas (cinza translúcido);
 * - plataforma: fita da plataforma com VERTEX COLORS por corte (laranja,
 *   terreno acima) / aterro (verde) e intensidade ∝ profundidade;
 * - cortina: paredes transversais terreno↔plataforma por seção (opcional);
 * - alargamento: banda âmbar além do bordo em corte (largura = % × largura
 *   do corte / 2 por lado — premissa "alargamento de corte → jazida");
 * - tracados: linha do eixo com z do greide (fallback terreno);
 * - barreiras: marcadores nas OAEs;
 * - marcador: plano transversal na estação ativa (updateStationMarker).
 */
import * as THREE from "three";
import {
  TracadoFrame,
  greideAt,
  interpLinha,
  terrenoAt,
} from "../mtp-geometry";
import type {
  MtpBarreira,
  MtpGeoEixo,
  MtpGeoSecao,
  MtpGeometria,
} from "../mtp";

const K_OFFSETS = 16; // amostras transversais por par de seções
const MAX_PAIR_GAP_FACTOR = 2.5; // pares além de passo×fator não geram fita
const PROF_MAX_COR = 10; // m — profundidade que satura a cor

const COR_TERRENO = new THREE.Color(0x64748b);
const COR_NEUTRA = new THREE.Color(0x94a3b8);
const COR_CORTE = new THREE.Color(0xf97316);
const COR_ATERRO = new THREE.Color(0x22c55e);
const COR_ALARG = new THREE.Color(0xf59e0b);

export interface CorridorLayers {
  terreno: THREE.Group;
  plataforma: THREE.Group;
  cortina: THREE.Group;
  alargamento: THREE.Group;
  tracados: THREE.Group;
  barreiras: THREE.Group;
}

export interface CorridorScene {
  scene: THREE.Scene;
  /** Grupo raiz (escala Y = exagero vertical). */
  root: THREE.Group;
  layers: CorridorLayers;
  marcador: THREE.Mesh;
  frames: Map<string, TracadoFrame>;
  eixos: Map<string, MtpGeoEixo>;
  bounds: {
    minX: number;
    minY: number;
    minZ: number;
    maxX: number;
    maxY: number;
    maxZ: number;
  };
  stats: { triangulos: number; secoes: number };
}

interface Acc {
  pos: number[];
  idx: number[];
  cor: number[];
}

function pushStrip(acc: Acc, rowA: number[][], rowB: number[][], corA: THREE.Color[], corB: THREE.Color[]) {
  const base = acc.pos.length / 3;
  const k = rowA.length;
  for (const p of rowA) acc.pos.push(p[0], p[1], p[2]);
  for (const p of rowB) acc.pos.push(p[0], p[1], p[2]);
  for (const c of corA) acc.cor.push(c.r, c.g, c.b);
  for (const c of corB) acc.cor.push(c.r, c.g, c.b);
  for (let i = 0; i < k - 1; i++) {
    const a = base + i;
    const b = base + i + 1;
    const c = base + k + i;
    const d = base + k + i + 1;
    acc.idx.push(a, c, b, b, c, d);
  }
}

function toMesh(acc: Acc, material: THREE.Material): THREE.Mesh | null {
  if (!acc.idx.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(acc.pos), 3));
  if (acc.cor.length) {
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(acc.cor), 3));
  }
  g.setIndex(acc.idx);
  g.computeVertexNormals();
  return new THREE.Mesh(g, material);
}

/** Linha [off,z,...] → domínio [min,max] de offsets. */
function dominio(flat: number[]): [number, number] | null {
  if (flat.length < 4) return null;
  return [flat[0], flat[flat.length - 2]];
}

function corPorDelta(d: number): THREE.Color {
  if (d > 0.02) {
    const t = Math.min(d / PROF_MAX_COR, 1);
    return COR_NEUTRA.clone().lerp(COR_CORTE, 0.35 + 0.65 * t);
  }
  if (d < -0.02) {
    const t = Math.min(-d / PROF_MAX_COR, 1);
    return COR_NEUTRA.clone().lerp(COR_ATERRO, 0.35 + 0.65 * t);
  }
  return COR_NEUTRA.clone();
}

interface Row {
  pts: number[][]; // K posições three [x,y,z]
  zTer: (number | null)[];
  zPlat: (number | null)[];
  offs: number[];
}

/** Amostra uma seção em K offsets comuns e projeta no plano via frame. */
function sampleRow(
  sec: MtpGeoSecao,
  frame: TracadoFrame,
  offs: number[],
): Row {
  const pts: number[][] = [];
  const zTer: (number | null)[] = [];
  const zPlat: (number | null)[] = [];
  for (const off of offs) {
    const zt = interpLinha(sec.terreno, off);
    const zp = interpLinha(sec.plataforma, off);
    zTer.push(zt);
    zPlat.push(zp);
    const { e, n } = frame.xyAt(sec.sta_m, off);
    // y provisório 0 — cada consumidor injeta o próprio z
    pts.push([e, 0, -n]);
    void zp;
  }
  return { pts, zTer, zPlat, offs };
}

export function buildCorridorScene(
  geometria: MtpGeometria,
  opts: {
    barreiras?: MtpBarreira[];
    alargamentoPct?: number;
    tiposEixo?: Map<string, string>;
  } = {},
): CorridorScene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0f172a);
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const sun = new THREE.DirectionalLight(0xffffff, 0.8);
  sun.position.set(1, 1.6, 1);
  scene.add(sun);

  const root = new THREE.Group();
  scene.add(root);

  const layers: CorridorLayers = {
    terreno: new THREE.Group(),
    plataforma: new THREE.Group(),
    cortina: new THREE.Group(),
    alargamento: new THREE.Group(),
    tracados: new THREE.Group(),
    barreiras: new THREE.Group(),
  };
  for (const g of Object.values(layers)) root.add(g);

  const frames = new Map<string, TracadoFrame>();
  const eixosMap = new Map<string, MtpGeoEixo>();
  const box = new THREE.Box3();
  let triangulos = 0;
  let nSecoes = 0;

  const matTerreno = new THREE.MeshLambertMaterial({
    color: COR_TERRENO,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
  });
  const matPlataforma = new THREE.MeshLambertMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
  });
  const matCortina = new THREE.MeshLambertMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const matAlarg = new THREE.MeshLambertMaterial({
    color: COR_ALARG,
    transparent: true,
    opacity: 0.4,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const alargPct = opts.alargamentoPct ?? 0;

  for (const eixo of geometria.eixos) {
    eixosMap.set(eixo.eixo_id, eixo);
    if (!eixo.tracado || eixo.tracado.en.length < 4) continue;
    const frame = new TracadoFrame(eixo.tracado);
    if (!frame.valido) continue;
    frames.set(eixo.eixo_id, frame);

    // ── Traçado (z do greide/terreno) ──
    const perfil = eixo.perfil;
    const linhaPos: number[] = [];
    const en = eixo.tracado.en;
    for (let i = 0; i + 1 < en.length; i += 2) {
      const sta = eixo.tracado.sta0_m + (i / 2) * eixo.tracado.passo_m;
      let z = perfil ? (greideAt(perfil, sta) ?? terrenoAt(perfil, sta)) : null;
      if (z == null) z = 0;
      linhaPos.push(en[i], z, -en[i + 1]);
    }
    if (linhaPos.length >= 6) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(linhaPos), 3));
      const ehRodovia = (opts.tiposEixo?.get(eixo.eixo_id) ?? "rodovia") === "rodovia";
      const line = new THREE.Line(
        g,
        new THREE.LineBasicMaterial({
          color: ehRodovia ? 0x22d3ee : 0x818cf8,
          transparent: !ehRodovia,
          opacity: ehRodovia ? 1 : 0.7,
        }),
      );
      line.userData = { eixoId: eixo.eixo_id };
      layers.tracados.add(line);
      g.computeBoundingBox();
      if (g.boundingBox) box.union(g.boundingBox);
    }

    // ── Fitas por pares de seções ──
    const secs = eixo.secoes;
    nSecoes += secs.length;
    if (secs.length >= 2) {
      const accTer: Acc = { pos: [], idx: [], cor: [] };
      const accPlat: Acc = { pos: [], idx: [], cor: [] };
      const accCort: Acc = { pos: [], idx: [], cor: [] };
      const accAlarg: Acc = { pos: [], idx: [], cor: [] };
      const maxGap = eixo.secoes_passo_m * MAX_PAIR_GAP_FACTOR;

      for (let i = 0; i < secs.length - 1; i++) {
        const A = secs[i];
        const B = secs[i + 1];
        const dSta = B.sta_m - A.sta_m;
        if (dSta <= 0 || dSta > maxGap) continue;

        const dTA = dominio(A.terreno);
        const dTB = dominio(B.terreno);
        const dPA = dominio(A.plataforma);
        const dPB = dominio(B.plataforma);
        if (!dTA || !dTB || !dPA || !dPB) continue;
        const lo = Math.max(dTA[0], dTB[0], dPA[0], dPB[0]);
        const hi = Math.min(dTA[1], dTB[1], dPA[1], dPB[1]);
        if (hi - lo < 2) continue;

        const offs: number[] = [];
        for (let k = 0; k < K_OFFSETS; k++) {
          offs.push(lo + ((hi - lo) * k) / (K_OFFSETS - 1));
        }
        const rowA = sampleRow(A, frame, offs);
        const rowB = sampleRow(B, frame, offs);

        // terreno
        const terA = rowA.pts.map((p, k) => [p[0], rowA.zTer[k] ?? 0, p[2]]);
        const terB = rowB.pts.map((p, k) => [p[0], rowB.zTer[k] ?? 0, p[2]]);
        const corTer = offs.map(() => COR_TERRENO);
        pushStrip(accTer, terA, terB, corTer, corTer);

        // plataforma com cor por corte/aterro
        const dA = offs.map((_, k) => (rowA.zTer[k] ?? 0) - (rowA.zPlat[k] ?? 0));
        const dB = offs.map((_, k) => (rowB.zTer[k] ?? 0) - (rowB.zPlat[k] ?? 0));
        const platA = rowA.pts.map((p, k) => [p[0], rowA.zPlat[k] ?? 0, p[2]]);
        const platB = rowB.pts.map((p, k) => [p[0], rowB.zPlat[k] ?? 0, p[2]]);
        pushStrip(accPlat, platA, platB, dA.map(corPorDelta), dB.map(corPorDelta));

        // cortina transversal na seção A (terreno↔plataforma)
        pushStrip(accCort, terA, platA, dA.map(corPorDelta), dA.map(corPorDelta));

        // alargamento (banda além do bordo em corte)
        if (alargPct > 0) {
          const emCorte = (d: number[]) => d.filter((v) => v > 0.02).length / d.length;
          const fCut = (emCorte(dA) + emCorte(dB)) / 2;
          if (fCut > 0.15) {
            const larguraCorte = (hi - lo) * fCut;
            const dOff = (alargPct * larguraCorte) / 2;
            if (dOff > 0.2) {
              for (const [borda, dir] of [
                [lo, -1],
                [hi, 1],
              ] as const) {
                const bordaEmCorte =
                  ((borda === lo ? dA[0] : dA[dA.length - 1]) +
                    (borda === lo ? dB[0] : dB[dB.length - 1])) /
                    2 >
                  0.02;
                if (!bordaEmCorte) continue;
                const zA = interpLinha(A.terreno, borda) ?? 0;
                const zB = interpLinha(B.terreno, borda) ?? 0;
                const pA0 = frame.xyAt(A.sta_m, borda);
                const pA1 = frame.xyAt(A.sta_m, borda + dir * dOff);
                const pB0 = frame.xyAt(B.sta_m, borda);
                const pB1 = frame.xyAt(B.sta_m, borda + dir * dOff);
                const corA = [COR_ALARG, COR_ALARG];
                pushStrip(
                  accAlarg,
                  [
                    [pA0.e, zA + 0.15, -pA0.n],
                    [pA1.e, zA + 0.15, -pA1.n],
                  ],
                  [
                    [pB0.e, zB + 0.15, -pB0.n],
                    [pB1.e, zB + 0.15, -pB1.n],
                  ],
                  corA,
                  corA,
                );
              }
            }
          }
        }
      }

      for (const [acc, mat, layer] of [
        [accTer, matTerreno, layers.terreno],
        [accPlat, matPlataforma, layers.plataforma],
        [accCort, matCortina, layers.cortina],
        [accAlarg, matAlarg, layers.alargamento],
      ] as const) {
        const mesh = toMesh(acc, mat);
        if (mesh) {
          mesh.userData = { eixoId: eixo.eixo_id };
          layer.add(mesh);
          triangulos += acc.idx.length / 3;
          mesh.geometry.computeBoundingBox();
          if (mesh.geometry.boundingBox) box.union(mesh.geometry.boundingBox);
        }
      }
    }
  }

  // ── Barreiras (OAEs) ──
  for (const b of opts.barreiras ?? []) {
    for (const [eixoId, frame] of frames) {
      if (b.sta_m < frame.sta0 || b.sta_m > frame.staFim) continue;
      const tipo = opts.tiposEixo?.get(eixoId) ?? "rodovia";
      if (tipo !== "rodovia") continue;
      const eixo = eixosMap.get(eixoId);
      const z =
        (eixo?.perfil
          ? (greideAt(eixo.perfil, b.sta_m) ?? terrenoAt(eixo.perfil, b.sta_m))
          : null) ?? 0;
      const p = frame.locate(b.sta_m);
      const marker = new THREE.Mesh(
        new THREE.OctahedronGeometry(8),
        new THREE.MeshLambertMaterial({ color: 0xf59e0b }),
      );
      marker.position.set(p.e, z + 18, -p.n);
      const haste = new THREE.Mesh(
        new THREE.CylinderGeometry(0.6, 0.6, 18),
        new THREE.MeshLambertMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.6 }),
      );
      haste.position.set(p.e, z + 9, -p.n);
      layers.barreiras.add(marker, haste);
      break;
    }
  }

  // ── Marcador de estação ──
  const marcador = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 36),
    new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  marcador.visible = false;
  root.add(marcador);

  const bounds = {
    minX: box.min.x,
    minY: box.min.y,
    minZ: box.min.z,
    maxX: box.max.x,
    maxY: box.max.y,
    maxZ: box.max.z,
  };
  return {
    scene,
    root,
    layers,
    marcador,
    frames,
    eixos: eixosMap,
    bounds,
    stats: { triangulos, secoes: nSecoes },
  };
}

/** Move o plano-marcador para (eixo, estação); esconde com sta=null. */
export function updateStationMarker(
  built: CorridorScene,
  eixoId: string | null,
  sta: number | null,
): void {
  if (!eixoId || sta == null) {
    built.marcador.visible = false;
    return;
  }
  const frame = built.frames.get(eixoId);
  if (!frame) {
    built.marcador.visible = false;
    return;
  }
  const eixo = built.eixos.get(eixoId);
  const z =
    (eixo?.perfil
      ? (greideAt(eixo.perfil, sta) ?? terrenoAt(eixo.perfil, sta))
      : null) ?? (built.bounds.minY + built.bounds.maxY) / 2;
  const p = frame.locate(sta);
  built.marcador.position.set(p.e, z, -p.n);
  // plano perpendicular ao eixo: normal do plano = direção do eixo
  const dir = new THREE.Vector3(-p.nn, 0, p.ne).normalize();
  built.marcador.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
  built.marcador.visible = true;
}

/** Ponto 3D (raycast) → (eixo, estação) pelo vértice de traçado mais próximo. */
export function stationFromPoint(
  built: CorridorScene,
  point: THREE.Vector3,
): { eixoId: string; sta: number } | null {
  const e = point.x;
  const n = -point.z;
  let best: { eixoId: string; sta: number; d2: number } | null = null;
  for (const eixoId of built.frames.keys()) {
    const eixo = built.eixos.get(eixoId);
    const t = eixo?.tracado;
    if (!t) continue;
    for (let i = 0; i + 1 < t.en.length; i += 2) {
      const de = t.en[i] - e;
      const dn = t.en[i + 1] - n;
      const d2 = de * de + dn * dn;
      if (best == null || d2 < best.d2) {
        best = { eixoId, sta: t.sta0_m + (i / 2) * t.passo_m, d2 };
      }
    }
  }
  return best ? { eixoId: best.eixoId, sta: best.sta } : null;
}

export function disposeCorridorScene(built: CorridorScene): void {
  built.scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = (mesh as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else if (mat) mat.dispose();
  });
}
