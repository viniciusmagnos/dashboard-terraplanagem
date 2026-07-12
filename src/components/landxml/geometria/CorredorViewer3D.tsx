/**
 * CorredorViewer3D — corredor 3D do pacote v2: fitas de terreno/plataforma
 * (cores por corte/aterro), cortina, alargamento, traçados, OAEs e marcador
 * de estação sincronizado. Clique no corredor seleciona a estação (raycast).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { AlertCircle, Hand, Maximize2, Mountain, Rotate3d } from "lucide-react";
import {
  buildCorridorScene,
  disposeCorridorScene,
  stationFromPoint,
  updateStationMarker,
  type CorridorScene,
} from "../../../lib/landxml-3d/corridor-scene";
import { useThreeViewport } from "../../../lib/landxml-3d/use-three-viewport";
import { fmt } from "../../../lib/format";
import type { MtpBarreira, MtpPacote } from "../../../lib/mtp";
import type { GeoSel } from "./SecoesTab";

type LayerKey =
  | "terreno"
  | "plataforma"
  | "cortina"
  | "alargamento"
  | "tracados"
  | "barreiras";

const LAYER_ROTULOS: [LayerKey, string][] = [
  ["terreno", "Terreno"],
  ["plataforma", "Plataforma"],
  ["cortina", "Cortina corte/aterro"],
  ["alargamento", "Alargamento"],
  ["tracados", "Traçados"],
  ["barreiras", "OAEs"],
];

type Vista = "topo" | "norte" | "sul" | "leste" | "oeste" | "iso";

const VISTAS: [Vista, string, string][] = [
  ["topo", "Topo", "Vista de cima (planta)"],
  ["norte", "N", "Olhando do norte para o sul"],
  ["sul", "S", "Olhando do sul para o norte"],
  ["leste", "L", "Olhando do leste para o oeste"],
  ["oeste", "O", "Olhando do oeste para o leste"],
  ["iso", "Iso", "Vista isométrica"],
];

export function CorredorViewer3D({
  pacote,
  sel,
  onSel,
  alargamentoPct,
  barreiras,
  altura = 560,
}: {
  pacote: MtpPacote;
  sel: GeoSel;
  onSel: (s: GeoSel) => void;
  alargamentoPct: number;
  barreiras: MtpBarreira[];
  altura?: number;
}) {
  const { containerRef, cameraRef, controlsRef, rendererRef, sceneRef } =
    useThreeViewport();
  const builtRef = useRef<CorridorScene | null>(null);
  const [exag, setExag] = useState(2);
  const [visiveis, setVisiveis] = useState<Record<LayerKey, boolean>>({
    terreno: true,
    plataforma: true,
    cortina: false,
    alargamento: true,
    tracados: true,
    barreiras: true,
  });
  const [stats, setStats] = useState<{ triangulos: number; secoes: number } | null>(null);
  const [alargDebounced, setAlargDebounced] = useState(alargamentoPct);
  const [modoPan, setModoPan] = useState(false);
  const selRef = useRef(sel);
  selRef.current = sel;

  // Pan: botão direito sempre; toggle troca o esquerdo girar ⇄ mover
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.screenSpacePanning = true;
    controls.mouseButtons = {
      LEFT: modoPan ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };
  }, [modoPan, controlsRef]);

  /** Enquadra a cena numa vista padrão (considera o exagero vertical). */
  const aplicarVista = (vista: Vista) => {
    const built = builtRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!built || !camera || !controls) return;
    const b = built.bounds;
    const ex = built.root.scale.y || 1;
    const cx = (b.minX + b.maxX) / 2;
    const cy = ((b.minY + b.maxY) / 2) * ex;
    const cz = (b.minZ + b.maxZ) / 2;
    const radius =
      Math.max(b.maxX - b.minX, (b.maxY - b.minY) * ex, b.maxZ - b.minZ, 1) *
      0.6;
    const fov = (camera.fov * Math.PI) / 180;
    const dist = radius / Math.sin(fov / 2);
    const alturaLateral = cy + radius * 0.25;
    const pos: Record<Vista, [number, number, number]> = {
      topo: [cx, cy + dist, cz + dist * 0.001],
      norte: [cx, alturaLateral, cz - dist], // câmera ao norte, olhando p/ sul
      sul: [cx, alturaLateral, cz + dist],
      leste: [cx + dist, alturaLateral, cz],
      oeste: [cx - dist, alturaLateral, cz],
      iso: [cx + dist * 0.7, cy + radius * 1.2, cz + dist * 0.7],
    };
    camera.position.set(...pos[vista]);
    controls.target.set(cx, cy, cz);
    camera.near = Math.max(dist / 1000, 0.1);
    camera.far = dist * 10;
    camera.updateProjectionMatrix();
    controls.update();
  };

  useEffect(() => {
    const t = window.setTimeout(() => setAlargDebounced(alargamentoPct), 200);
    return () => window.clearTimeout(t);
  }, [alargamentoPct]);

  const tiposEixo = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of pacote.eixos) m.set(e.id, e.tipo);
    return m;
  }, [pacote.eixos]);

  // (Re)build da cena
  useEffect(() => {
    const geometria = pacote.geometria;
    if (!geometria) return;
    if (builtRef.current) {
      disposeCorridorScene(builtRef.current);
      builtRef.current = null;
      sceneRef.current = null;
    }
    const built = buildCorridorScene(geometria, {
      barreiras,
      alargamentoPct: alargDebounced,
      tiposEixo,
    });
    builtRef.current = built;
    built.root.scale.y = exag;
    for (const [k, v] of Object.entries(visiveis)) {
      built.layers[k as LayerKey].visible = v;
    }
    sceneRef.current = built.scene;
    setStats(built.stats);
    aplicarVista("iso");
    const s = selRef.current;
    updateStationMarker(built, s.eixoId, s.sta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacote.geometria, alargDebounced, barreiras, tiposEixo]);

  // dispose ao desmontar
  useEffect(
    () => () => {
      if (builtRef.current) {
        disposeCorridorScene(builtRef.current);
        builtRef.current = null;
      }
    },
    [],
  );

  // exagero vertical
  useEffect(() => {
    if (builtRef.current) builtRef.current.root.scale.y = exag;
  }, [exag]);

  // toggles de camadas
  useEffect(() => {
    const built = builtRef.current;
    if (!built) return;
    for (const [k, v] of Object.entries(visiveis)) {
      built.layers[k as LayerKey].visible = v;
    }
  }, [visiveis]);

  // marcador de estação
  useEffect(() => {
    if (builtRef.current) updateStationMarker(builtRef.current, sel.eixoId, sel.sta);
  }, [sel]);

  // clique (raycast) → estação; distingue de drag do orbit
  useEffect(() => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    if (!renderer || !camera) return;
    const el = renderer.domElement;
    let down: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e: PointerEvent) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved > 5) return;
      const built = builtRef.current;
      if (!built) return;
      const rect = el.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, camera);
      const alvos = [
        ...built.layers.plataforma.children,
        ...built.layers.terreno.children,
      ];
      const hits = ray.intersectObjects(alvos, false);
      if (!hits.length) return;
      const p = hits[0].point.clone();
      p.y /= builtRef.current!.root.scale.y || 1;
      const achado = stationFromPoint(built, p);
      if (achado) onSel({ eixoId: achado.eixoId, sta: achado.sta });
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onSel]);

  if (!pacote.geometria) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <AlertCircle size={15} /> Pacote sem geometria.
      </div>
    );
  }

  return (
    <div className="relative w-full bg-slate-900 rounded-lg overflow-hidden" style={{ height: altura }}>
      <div ref={containerRef} className="absolute inset-0" />

      <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur text-xs text-white">
        <Mountain size={14} className="text-manta" />
        <span className="font-semibold uppercase tracking-wider">3D do corredor</span>
        {stats && (
          <span className="text-zinc-400 ml-1">
            · {fmt(stats.secoes)} seções · {fmt(stats.triangulos)} tris
          </span>
        )}
      </div>

      <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur text-xs text-white">
          <label className="flex items-center gap-2">
            <span>Z exag</span>
            <input
              type="range"
              min={1}
              max={10}
              step={0.5}
              value={exag}
              onChange={(e) => setExag(parseFloat(e.target.value))}
              className="w-20"
            />
            <span className="w-8 text-right">{exag.toFixed(1)}×</span>
          </label>
          <button
            onClick={() => setModoPan((v) => !v)}
            title={
              modoPan
                ? "Botão esquerdo: MOVER (clique para voltar a girar)"
                : "Botão esquerdo: GIRAR (clique para mover/pan)"
            }
            className={`p-1 rounded hover:bg-white/10 ${modoPan ? "bg-manta/40" : ""}`}
          >
            {modoPan ? <Hand size={14} /> : <Rotate3d size={14} />}
          </button>
          <button
            onClick={() => aplicarVista("iso")}
            title="Recentralizar (isométrica)"
            className="p-1 rounded hover:bg-white/10"
          >
            <Maximize2 size={14} />
          </button>
        </div>
        <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-black/60 backdrop-blur text-[11px] text-white">
          <span className="text-zinc-400 mr-0.5">Vistas:</span>
          {VISTAS.map(([v, rotulo, dica]) => (
            <button
              key={v}
              onClick={() => aplicarVista(v)}
              title={dica}
              className="px-1.5 py-0.5 rounded hover:bg-white/15 border border-white/10"
            >
              {rotulo}
            </button>
          ))}
        </div>
      </div>

      <div className="absolute bottom-3 left-3 flex items-center gap-3 flex-wrap px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur text-xs text-white">
        {LAYER_ROTULOS.map(([k, rotulo]) => (
          <label key={k} className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={visiveis[k]}
              onChange={(e) =>
                setVisiveis((prev) => ({ ...prev, [k]: e.target.checked }))
              }
              className="accent-manta"
            />
            {rotulo}
          </label>
        ))}
        <span className="text-zinc-400">
          · arrastar = {modoPan ? "mover" : "girar"} · botão direito = mover ·
          roda = zoom · clique = escolher estaca
        </span>
      </div>
    </div>
  );
}

export default CorredorViewer3D;
