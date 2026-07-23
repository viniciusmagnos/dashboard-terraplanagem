/**
 * PerfilGeologicoView — perfil geológico oficial extraído do DWG de perfil
 * (bloco `perfil_geologico`). Dois modos:
 *  • "Horizontes" — terreno/greide + topos de rocha RAM (2ª) e RAD (3ª) + NA
 *    (linhas interpretadas pelo geólogo), com a comparação corte por categoria
 *    HORIZONTE × FURO.
 *  • "Rachuras/Formações" — reproduz o "perfil limpo": bandas hachuradas por
 *    formação (Fm. Ponta Grossa, Grupo Itararé, Fm. Serra Geral, Aluvião,
 *    Aterro…) com os nomes dos materiais (SR/RAM/RAD + litologia) como no DWG.
 */
import {
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Layers, Mountain, Plus, Minus, Maximize2 } from "lucide-react";
import { fmt } from "../../../lib/format";
import { staToKmLabel } from "../../../lib/mtp";
import type {
  MtpEstratoGeo,
  MtpGeotecnia,
  MtpLinhaHorizonte,
  MtpPerfilEixo,
  MtpPerfilGeologico,
  MtpSondagemPerfil,
} from "../../../lib/mtp";

type Modo = "horizontes" | "rachuras" | "sondagens";

/* ── Cor por categoria de escavação DNIT (mesmas de SecaoTransversalSVG) ── */
const COR_CAT: Record<number, string> = { 1: "#34d399", 2: "#f59e0b", 3: "#f43f5e" };
const CAT_LABEL: Record<number, string> = {
  1: "1ª cat (solo)",
  2: "2ª cat (rocha alterada / N≥50)",
  3: "3ª cat (rocha sã)",
};
const TIPO_LABEL: Record<string, string> = {
  percussao: "SPT (percussão)",
  mista: "mista",
  trado: "trado",
  desconhecido: "—",
};

/* ── Estilo por MATERIAL (litologia = matiz/hachura, alteração = tom) ──
 * A rachura é separada pela sua classe SR/RAM/RAD + litologia: a litologia dá
 * a cor-base e o padrão de hachura; a alteração escurece/clareia o tom (SR =
 * rocha sã, mais escuro/competente; RAM = alterada mole, mais claro). */
type PatKind = "dashes" | "dots" | "vees" | "dots-sparse" | "diagonal" | "cross";
const LITOLOGIA_STYLE: Record<string, { cor: string; pat: PatKind }> = {
  argilito: { cor: "#b7c27a", pat: "dashes" },
  siltito: { cor: "#aeb878", pat: "dashes" },
  folhelho: { cor: "#9fb06e", pat: "dashes" },
  arenito: { cor: "#e0c179", pat: "dots" },
  basalto: { cor: "#8fa9bd", pat: "vees" },
  "diabásio": { cor: "#7f9bb0", pat: "vees" },
  "aluvião": { cor: "#7fc9a8", pat: "dots-sparse" },
  aterro: { cor: "#d69a6a", pat: "diagonal" },
  "colúvio": { cor: "#c2b088", pat: "cross" },
};
const SOLO_STYLE: Record<string, { cor: string; pat: PatKind }> = {
  Aluvião: { cor: "#7fc9a8", pat: "dots-sparse" },
  Aterro: { cor: "#d69a6a", pat: "diagonal" },
  Colúvio: { cor: "#c2b088", pat: "cross" },
};
const STYLE_FALLBACK = { cor: "#94a3b8", pat: "diagonal" as PatKind };
// alteração → fator de tom (SR/RAD escuros = mais competentes; RAM claro)
const WEATH_FACTOR: Record<string, number> = { SR: 0.7, RAD: 0.92, RAM: 1.22 };

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  if (f <= 1) {
    r *= f;
    g *= f;
    b *= f;
  } else {
    const t = f - 1;
    r += (255 - r) * t;
    g += (255 - g) * t;
    b += (255 - b) * t;
  }
  const c = (x: number) =>
    Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function estiloMaterial(e: MtpEstratoGeo): { cor: string; pat: PatKind } {
  const base =
    (e.litologia && LITOLOGIA_STYLE[e.litologia.toLowerCase()]) ||
    SOLO_STYLE[e.formacao] ||
    STYLE_FALLBACK;
  const f = (e.alteracao && WEATH_FACTOR[e.alteracao.toUpperCase()]) || 1;
  return { cor: shade(base.cor, f), pat: base.pat };
}

function materialLabel(e: MtpEstratoGeo): string {
  return (
    e.material ||
    [e.alteracao, e.litologia].filter(Boolean).join(" ") ||
    e.formacao
  );
}
function materialSlug(m: string): string {
  return m.replace(/[^A-Za-z0-9]/g, "") || "x";
}

export function PerfilGeologicoView({
  perfil,
  geo,
}: {
  perfil: MtpPerfilGeologico;
  geo: MtpGeotecnia | null;
}) {
  const [eixoId, setEixoId] = useState<string>(perfil.eixos[0]?.eixo_id ?? "");
  const eixo = perfil.eixos.find((e) => e.eixo_id === eixoId) ?? perfil.eixos[0];

  const temEstratos = useMemo(
    () => perfil.eixos.some((e) => (e.estratos?.length ?? 0) > 0),
    [perfil],
  );
  const temSondagens = useMemo(
    () => perfil.eixos.some((e) => (e.sondagens?.length ?? 0) > 0),
    [perfil],
  );
  const [modo, setModo] = useState<Modo>(
    temEstratos ? "rachuras" : temSondagens ? "sondagens" : "horizontes",
  );
  const [overlay, setOverlay] = useState(false); // horizontes por cima das rachuras
  const [mostrarRotulos, setMostrarRotulos] = useState(true); // nomes na figura
  const [sobreporSondagens, setSobreporSondagens] = useState(false); // palitos por cima
  const [furoSelId, setFuroSelId] = useState<string | null>(null);
  useEffect(() => setFuroSelId(null), [eixoId, modo]);

  const mostrarSondagens =
    temSondagens && (modo === "sondagens" || sobreporSondagens);
  const furoSel =
    (mostrarSondagens && eixo?.sondagens?.find((f) => f.id === furoSelId)) || null;

  // corte por categoria via furo (materiais) para comparar com o horizonte
  const furoPorEixo = useMemo(() => {
    const m = new Map<string, { c1: number; c2: number; c3: number }>();
    for (const e of geo?.materiais?.por_eixo ?? []) {
      m.set(e.eixo_id, { c1: e.corte_1cat, c2: e.corte_2cat, c3: e.corte_3cat });
    }
    return m;
  }, [geo]);

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-medium flex items-center gap-1.5">
            <Mountain size={14} className="text-amber-400" />
            Perfil geológico do projeto
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {modo === "rachuras"
              ? "Rachuras por formação geológica com os nomes dos materiais (SR/RAM/RAD + litologia), como no DWG de perfil."
              : modo === "sondagens"
                ? "Furos de sondagem do DWG (palitos SPT): camadas coloridas por categoria de escavação, NA e impenetrável. Clique num furo para ver as camadas."
                : "Topo de rocha interpretado pelo geólogo no DWG (RAM = 2ª cat, RAD/RS = 3ª cat). Onde há painel, o corte por categoria usa estes horizontes."}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(temEstratos || temSondagens) && (
            <div className="inline-flex rounded border border-border overflow-hidden text-xs">
              {temEstratos && (
                <button
                  type="button"
                  onClick={() => setModo("rachuras")}
                  className={`px-2 py-1 ${
                    modo === "rachuras"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Rachuras/Formações
                </button>
              )}
              <button
                type="button"
                onClick={() => setModo("horizontes")}
                className={`px-2 py-1 border-l border-border ${
                  modo === "horizontes"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                Horizontes
              </button>
              {temSondagens && (
                <button
                  type="button"
                  onClick={() => setModo("sondagens")}
                  className={`px-2 py-1 border-l border-border ${
                    modo === "sondagens"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Sondagens
                </button>
              )}
            </div>
          )}
          {modo === "rachuras" && (
            <>
              <label className="text-[11px] text-muted-foreground flex items-center gap-1 select-none">
                <input
                  type="checkbox"
                  checked={mostrarRotulos}
                  onChange={(e) => setMostrarRotulos(e.target.checked)}
                />
                rótulos
              </label>
              <label className="text-[11px] text-muted-foreground flex items-center gap-1 select-none">
                <input
                  type="checkbox"
                  checked={overlay}
                  onChange={(e) => setOverlay(e.target.checked)}
                />
                horizontes
              </label>
            </>
          )}
          {temSondagens && modo !== "sondagens" && (
            <label className="text-[11px] text-muted-foreground flex items-center gap-1 select-none">
              <input
                type="checkbox"
                checked={sobreporSondagens}
                onChange={(e) => setSobreporSondagens(e.target.checked)}
              />
              sondagens
            </label>
          )}
          <select
            value={eixoId}
            onChange={(e) => setEixoId(e.target.value)}
            className="bg-background border border-border rounded px-2 py-1 text-xs"
          >
            {perfil.eixos.map((e) => (
              <option key={e.eixo_id} value={e.eixo_id}>
                {e.eixo_id}
              </option>
            ))}
          </select>
        </div>
      </div>

      {eixo && (
        <PerfilSVG
          eixo={eixo}
          modo={modo}
          overlay={overlay}
          mostrarRotulos={mostrarRotulos}
          mostrarSondagens={mostrarSondagens}
          furoSelId={furoSelId}
          onFuroSel={setFuroSelId}
        />
      )}

      {furoSel && <FuroDetalhe furo={furoSel} />}

      {/* comparação horizonte × furo */}
      <div className="border-t border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="px-3 py-2">Eixo</th>
              <th className="px-3 py-2 text-right">Corte coberto</th>
              <th className="px-3 py-2 text-right text-emerald-400">1ª (horiz.)</th>
              <th className="px-3 py-2 text-right text-amber-400">2ª (horiz.)</th>
              <th className="px-3 py-2 text-right text-rose-400">3ª (horiz.)</th>
              <th className="px-3 py-2 text-right text-muted-foreground">
                2ª/3ª por furo
              </th>
            </tr>
          </thead>
          <tbody>
            {perfil.categorias_por_eixo.map((c) => {
              const f = furoPorEixo.get(c.eixo_id);
              const cob =
                c.v_corte_total > 0
                  ? Math.round((c.v_corte_coberto / c.v_corte_total) * 100)
                  : 0;
              return (
                <tr key={c.eixo_id} className="border-t border-border">
                  <td className="px-3 py-1.5">{c.eixo_id}</td>
                  <td className="px-3 py-1.5 text-right text-muted-foreground">
                    {cob}%
                  </td>
                  <td className="px-3 py-1.5 text-right">{fmt(c.corte_1cat)}</td>
                  <td className="px-3 py-1.5 text-right">{fmt(c.corte_2cat)}</td>
                  <td className="px-3 py-1.5 text-right">{fmt(c.corte_3cat)}</td>
                  <td className="px-3 py-1.5 text-right text-muted-foreground">
                    {f ? `${fmt(f.c2)} / ${fmt(f.c3)}` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {perfil.warnings.length > 0 && (
        <div className="px-4 py-2 border-t border-border text-[11px] text-muted-foreground space-y-0.5">
          {perfil.warnings.map((w, i) => (
            <p key={i}>• {w}</p>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── centroide e área de um anel (estação/cota) via shoelace ── */
function centroideArea(pts: [number, number][]): { c: [number, number]; area: number } {
  const n = pts.length;
  if (n < 3) {
    if (!n) return { c: [0, 0], area: 0 };
    return { c: pts[0], area: 0 };
  }
  let a = 0,
    cx = 0,
    cy = 0;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % n];
    const cr = x0 * y1 - x1 * y0;
    a += cr;
    cx += (x0 + x1) * cr;
    cy += (y0 + y1) * cr;
  }
  a *= 0.5;
  if (Math.abs(a) < 1e-9) {
    const sx = pts.reduce((s, p) => s + p[0], 0) / n;
    const sy = pts.reduce((s, p) => s + p[1], 0) / n;
    return { c: [sx, sy], area: 0 };
  }
  return { c: [cx / (6 * a), cy / (6 * a)], area: Math.abs(a) };
}

/* ── SVG do perfil (horizontes e/ou rachuras) ─────────────── */

function PerfilSVG({
  eixo,
  modo,
  overlay,
  mostrarRotulos,
  mostrarSondagens,
  furoSelId,
  onFuroSel,
}: {
  eixo: MtpPerfilEixo;
  modo: Modo;
  overlay: boolean;
  mostrarRotulos: boolean;
  mostrarSondagens: boolean;
  furoSelId: string | null;
  onFuroSel: (id: string | null) => void;
}) {
  const estratos: MtpEstratoGeo[] = eixo.estratos ?? [];
  const mostrarRachuras = modo === "rachuras" && estratos.length > 0;
  const mostrarHorizontes = modo === "horizontes" || overlay;
  const sondagens: MtpSondagemPerfil[] = useMemo(
    () => (mostrarSondagens ? (eixo.sondagens ?? []) : []),
    [mostrarSondagens, eixo.sondagens],
  );

  // interpolação linear do terreno (topo de furo sem COTA = terreno na estação)
  const terrenoAt = useMemo(() => {
    const pts = eixo.terreno;
    return (s: number): number | null => {
      if (pts.length === 0) return null;
      if (s <= pts[0][0]) return pts[0][1];
      if (s >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
      let lo = 0,
        hi = pts.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (pts[mid][0] < s) lo = mid + 1;
        else hi = mid;
      }
      const [x1, y1] = pts[lo];
      const [x0, y0] = pts[lo - 1] ?? pts[lo];
      return x1 === x0 ? y1 : y0 + ((y1 - y0) * (s - x0)) / (x1 - x0);
    };
  }, [eixo.terreno]);

  const furoTopo = (f: MtpSondagemPerfil): number | null =>
    f.cota_topo_m ?? terrenoAt(f.sta_m);
  const furoProf = (f: MtpSondagemPerfil): number =>
    f.prof_m ?? (f.camadas.length ? f.camadas[f.camadas.length - 1].a_m : 0);

  const cena = useMemo(() => {
    const W = 960;
    const H = mostrarRachuras ? 340 : mostrarSondagens ? 320 : 260;
    const padX = 46;
    const padY = 16;

    const furoPts: [number, number][] = [];
    for (const f of sondagens) {
      const top = f.cota_topo_m ?? terrenoAt(f.sta_m);
      if (top == null) continue;
      const prof = f.prof_m ?? (f.camadas.length ? f.camadas[f.camadas.length - 1].a_m : 0);
      furoPts.push([f.sta_m, top], [f.sta_m, top - prof]);
    }

    const all: [number, number][] = [
      ...eixo.terreno,
      ...eixo.greide,
      ...eixo.topo_2cat.flatMap((l) => l.pts),
      ...eixo.topo_3cat.flatMap((l) => l.pts),
      ...estratos.flatMap((s) => s.poligonos.flat()),
      ...furoPts,
    ];
    if (all.length < 2) return null;
    const sMin = Math.min(...all.map((p) => p[0]));
    const sMax = Math.max(...all.map((p) => p[0]));
    const zMin = Math.min(...all.map((p) => p[1])) - 3;
    const zMax = Math.max(...all.map((p) => p[1])) + 3;
    const X = (s: number) =>
      padX + ((s - sMin) / Math.max(sMax - sMin, 1)) * (W - padX * 2);
    const Y = (z: number) =>
      H - padY - ((z - zMin) / Math.max(zMax - zMin, 1)) * (H - padY * 2);
    const path = (pts: [number, number][]) =>
      pts.length
        ? pts
            .map((p, i) => `${i ? "L" : "M"}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`)
            .join("")
        : "";
    const ring = (pts: [number, number][]) => (path(pts) ? path(pts) + "Z" : "");
    const paths = (lines: MtpLinhaHorizonte[]) => lines.map((l) => path(l.pts));
    return { W, H, X, Y, sMin, sMax, zMin, zMax, path, ring, paths };
  }, [eixo, estratos, mostrarRachuras, mostrarSondagens, sondagens, terrenoAt]);

  // palitos de sondagem em (X(sta), Y(cota)) — camadas coloridas por categoria
  const furosDraw = useMemo(() => {
    if (!cena || sondagens.length === 0) return [];
    const out: {
      f: MtpSondagemPerfil;
      x: number;
      yTop: number;
      yBot: number;
      yNa: number | null;
      segs: { y0: number; y1: number; cor: string; titulo: string }[];
    }[] = [];
    for (const f of sondagens) {
      const top = furoTopo(f);
      if (top == null) continue;
      const prof = furoProf(f);
      const segs = f.camadas
        .map((c) => ({
          y0: cena.Y(top - c.de_m),
          y1: cena.Y(top - c.a_m),
          cor: COR_CAT[c.categoria ?? 0] ?? "#64748b",
          titulo: `${fmt(c.de_m, 1)}–${fmt(c.a_m, 1)} m · N=${
            c.n_spt ?? "—"
          } · ${c.material}`,
        }))
        .filter((s) => s.y1 > s.y0 + 0.3);
      out.push({
        f,
        x: cena.X(f.sta_m),
        yTop: cena.Y(top),
        yBot: cena.Y(top - prof),
        yNa: f.na_m != null ? cena.Y(top - f.na_m) : null,
        segs,
      });
    }
    return out;
  }, [cena, sondagens]);

  // um rótulo por rachura = o material dela, centralizado no maior polígono
  const rotulosEstrato = useMemo(() => {
    if (!cena || !mostrarRachuras) return [];
    const out: { x: number; y: number; texto: string }[] = [];
    for (const e of estratos) {
      let melhor: { c: [number, number]; area: number } | null = null;
      for (const poly of e.poligonos) {
        const ca = centroideArea(poly);
        if (!melhor || ca.area > melhor.area) melhor = ca;
      }
      if (!melhor) continue;
      out.push({
        x: cena.X(melhor.c[0]),
        y: cena.Y(melhor.c[1]),
        texto: materialLabel(e),
      });
    }
    return out;
  }, [cena, estratos, mostrarRachuras]);

  // classes de material presentes (cada rachura é separada por elas)
  const materiais = useMemo(() => {
    const m = new Map<
      string,
      { label: string; cor: string; pat: PatKind; categoria: number | null; slug: string }
    >();
    for (const e of estratos) {
      const label = materialLabel(e);
      if (m.has(label)) continue;
      const st = estiloMaterial(e);
      m.set(label, {
        label,
        cor: st.cor,
        pat: st.pat,
        categoria: e.categoria ?? null,
        slug: materialSlug(label),
      });
    }
    // ordena por categoria depois nome, p/ a legenda ficar estável
    return [...m.values()].sort(
      (a, b) => (a.categoria ?? 9) - (b.categoria ?? 9) || a.label.localeCompare(b.label),
    );
  }, [estratos]);

  // ── zoom + pan (viewBox) ──────────────────────────────────
  const svgRef = useRef<SVGSVGElement | null>(null);
  const panRef = useRef<{ px: number; py: number; vx: number; vy: number } | null>(null);
  const [view, setView] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const W = cena?.W ?? 960;
  const H = cena?.H ?? 340;
  const MINW = W / 60; // limite de aproximação
  const vb = view ?? { x: 0, y: 0, w: W, h: H };
  const zoomEmDado = vb.w < W - 0.5;
  // fator p/ manter fonte/traço com tamanho de TELA constante ao aproximar
  const k = vb.w / W;

  // reset do zoom quando a cena muda (novo eixo / modo)
  useEffect(() => {
    setView(null);
  }, [cena]);

  // roda do mouse: zoom com foco no cursor (listener nativo não-passivo)
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      const rect = el.getBoundingClientRect();
      setView((prev) => {
        const cur = prev ?? { x: 0, y: 0, w: W, h: H };
        const cx = cur.x + ((ev.clientX - rect.left) / rect.width) * cur.w;
        const cy = cur.y + ((ev.clientY - rect.top) / rect.height) * cur.h;
        const factor = ev.deltaY < 0 ? 0.84 : 1 / 0.84;
        const nw = Math.min(W, Math.max(MINW, cur.w * factor));
        const nh = nw * (H / W);
        const nx = Math.min(Math.max(cx - ((cx - cur.x) / cur.w) * nw, 0), W - nw);
        const ny = Math.min(Math.max(cy - ((cy - cur.y) / cur.h) * nh, 0), H - nh);
        return { x: nx, y: ny, w: nw, h: nh };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [W, H, MINW]);

  const zoomPasso = (fator: number) =>
    setView((prev) => {
      const cur = prev ?? { x: 0, y: 0, w: W, h: H };
      const cx = cur.x + cur.w / 2;
      const cy = cur.y + cur.h / 2;
      const nw = Math.min(W, Math.max(MINW, cur.w * fator));
      const nh = nw * (H / W);
      const nx = Math.min(Math.max(cx - nw / 2, 0), W - nw);
      const ny = Math.min(Math.max(cy - nh / 2, 0), H - nh);
      return { x: nx, y: ny, w: nw, h: nh };
    });

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!zoomEmDado) return; // só arrasta quando há zoom
    panRef.current = { px: e.clientX, py: e.clientY, vx: vb.x, vy: vb.y };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const p = panRef.current;
    if (!p) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const dx = ((e.clientX - p.px) / rect.width) * vb.w;
    const dy = ((e.clientY - p.py) / rect.height) * vb.h;
    setView({
      x: Math.min(Math.max(p.vx - dx, 0), W - vb.w),
      y: Math.min(Math.max(p.vy - dy, 0), H - vb.h),
      w: vb.w,
      h: vb.h,
    });
  };
  const onPointerUp = () => {
    panRef.current = null;
  };

  if (!cena) {
    return (
      <div className="p-3 text-sm text-muted-foreground">
        Sem geometria suficiente para plotar o perfil de {eixo.eixo_id}.
      </div>
    );
  }

  // ticks de cota
  const ticks: number[] = [];
  const step = Math.max(5, Math.round((cena.zMax - cena.zMin) / 6 / 5) * 5);
  for (let z = Math.ceil(cena.zMin / step) * step; z <= cena.zMax; z += step) {
    ticks.push(z);
  }

  // id único por eixo p/ os <pattern> não colidirem no <defs> global
  const uid = eixo.eixo_id.replace(/[^A-Za-z0-9]/g, "");
  const patId = (label: string) => `pg-${uid}-${materialSlug(label)}`;

  return (
    <div className="p-3">
      {/* legenda */}
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-1 flex-wrap">
        {modo === "sondagens" ? (
          <>
            {[1, 2, 3].map((c) => (
              <span key={c} className="flex items-center gap-1" title={CAT_LABEL[c]}>
                <span
                  className="inline-block w-3 h-3 rounded-sm border border-white/20"
                  style={{ backgroundColor: COR_CAT[c] }}
                />
                {c}ª cat
              </span>
            ))}
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-sky-400" /> NA
            </span>
            <span className="text-muted-foreground/60">
              {sondagens.length} furos · clique p/ ver camadas
            </span>
          </>
        ) : mostrarRachuras ? (
          materiais.map((m) => (
            <span
              key={m.label}
              className="flex items-center gap-1"
              title={m.categoria ? `${m.categoria}ª categoria de escavação` : undefined}
            >
              <span
                className="inline-block w-3 h-3 rounded-sm border border-white/20"
                style={{ backgroundColor: m.cor }}
              />
              {m.label}
              {m.categoria && (
                <span className="text-muted-foreground/60">({m.categoria}ª)</span>
              )}
            </span>
          ))
        ) : (
          <>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-0.5 bg-emerald-500" /> terreno
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-0.5 bg-cyan-400" /> greide
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-0.5 bg-amber-400" /> topo RAM (2ª cat)
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-0.5 bg-rose-500" /> topo RAD/RS (3ª cat)
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-0.5 border-t border-dashed border-sky-400" />{" "}
              NA
            </span>
          </>
        )}
        {mostrarSondagens && modo !== "sondagens" && (
          <span className="text-muted-foreground/60">
            · palitos: {sondagens.length} furos
          </span>
        )}
        <span className="ml-auto flex items-center gap-1">
          <Layers size={11} /> {staToKmLabel(eixo.sta_min_m)} →{" "}
          {staToKmLabel(eixo.sta_max_m)}
        </span>
      </div>
      <div className="relative">
      <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
        <button
          type="button"
          onClick={() => zoomPasso(0.7)}
          title="Aproximar"
          className="w-6 h-6 flex items-center justify-center rounded bg-slate-800/80 border border-border text-slate-200 hover:bg-slate-700"
        >
          <Plus size={13} />
        </button>
        <button
          type="button"
          onClick={() => zoomPasso(1 / 0.7)}
          title="Afastar"
          className="w-6 h-6 flex items-center justify-center rounded bg-slate-800/80 border border-border text-slate-200 hover:bg-slate-700"
        >
          <Minus size={13} />
        </button>
        <button
          type="button"
          onClick={() => setView(null)}
          disabled={!zoomEmDado}
          title="Ajustar tudo"
          className="w-6 h-6 flex items-center justify-center rounded bg-slate-800/80 border border-border text-slate-200 hover:bg-slate-700 disabled:opacity-40"
        >
          <Maximize2 size={12} />
        </button>
      </div>
      <svg
        ref={svgRef}
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        style={{ cursor: zoomEmDado ? (panRef.current ? "grabbing" : "grab") : "default", touchAction: "none" }}
        className="w-full h-auto bg-slate-900 rounded"
      >
        {mostrarRachuras && (
          <defs>
            {materiais.map((m) => (
              <MaterialPattern key={m.label} id={patId(m.label)} cor={m.cor} pat={m.pat} />
            ))}
          </defs>
        )}
        {ticks.map((z) => (
          <g key={z}>
            <line
              x1={cena.X(cena.sMin)}
              y1={cena.Y(z)}
              x2={cena.X(cena.sMax)}
              y2={cena.Y(z)}
              stroke="#1e293b"
              strokeWidth={1}
            />
            <text
              x={vb.x + 4 * k}
              y={cena.Y(z) + 3 * k}
              fontSize={9 * k}
              fill="#64748b"
            >
              {z}
            </text>
          </g>
        ))}

        {/* rachuras separadas por material (SR/RAM/RAD + litologia) */}
        {mostrarRachuras &&
          estratos.map((s, si) => {
            const st = estiloMaterial(s);
            const label = materialLabel(s);
            const cat = s.categoria ? ` · ${s.categoria}ª cat` : "";
            return s.poligonos.map((poly, pi) => (
              <path
                key={`e${si}-${pi}`}
                d={cena.ring(poly)}
                fill={`url(#${patId(label)})`}
                stroke={st.cor}
                strokeWidth={0.6}
                strokeOpacity={0.7}
                vectorEffect="non-scaling-stroke"
              >
                <title>
                  {label} · {s.formacao}
                  {cat}
                </title>
              </path>
            ));
          })}

        {/* greide + terreno (sempre) */}
        <path
          d={cena.path(eixo.greide)}
          fill="none"
          stroke="#22d3ee"
          strokeWidth={1.3}
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={cena.path(eixo.terreno)}
          fill="none"
          stroke="#10b981"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />

        {/* horizontes de rocha (modo horizontes ou overlay) */}
        {mostrarHorizontes && (
          <>
            {cena.paths(eixo.topo_3cat).map((d, i) => (
              <path
                key={`rad${i}`}
                d={d}
                fill="none"
                stroke="#f43f5e"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {cena.paths(eixo.topo_2cat).map((d, i) => (
              <path
                key={`ram${i}`}
                d={d}
                fill="none"
                stroke="#f59e0b"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {cena.paths(eixo.na).map((d, i) => (
              <path
                key={`na${i}`}
                d={d}
                fill="none"
                stroke="#38bdf8"
                strokeWidth={1.2}
                strokeDasharray="4 3"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </>
        )}

        {/* um nome por rachura, centralizado no polígono */}
        {mostrarRachuras &&
          mostrarRotulos &&
          rotulosEstrato.map((f, i) => (
            <text
              key={`lbl${i}`}
              x={f.x}
              y={f.y}
              fontSize={8 * k}
              fill="#f8fafc"
              stroke="#0f172a"
              strokeWidth={0.6 * k}
              paintOrder="stroke"
              textAnchor="middle"
              dominantBaseline="central"
            >
              {f.texto}
            </text>
          ))}

        {/* palitos de sondagem (camadas por categoria + NA), clicáveis */}
        {furosDraw.map((fd) => {
          const sel = fd.f.id === furoSelId;
          return (
            <g
              key={fd.f.id}
              className="cursor-pointer"
              onClick={() => onFuroSel(sel ? null : fd.f.id)}
            >
              {/* haste-base (fina) p/ ancorar furos sem camadas */}
              <line
                x1={fd.x}
                y1={fd.yTop}
                x2={fd.x}
                y2={fd.yBot}
                stroke="#94a3b8"
                strokeWidth={sel ? 2 : 1}
                strokeOpacity={fd.segs.length ? 0.5 : 0.85}
                vectorEffect="non-scaling-stroke"
              />
              {fd.segs.map((sg, i) => (
                <line
                  key={i}
                  x1={fd.x}
                  y1={sg.y0}
                  x2={fd.x}
                  y2={sg.y1}
                  stroke={sg.cor}
                  strokeWidth={sel ? 7 : 5}
                  strokeOpacity={0.95}
                  vectorEffect="non-scaling-stroke"
                >
                  <title>{sg.titulo}</title>
                </line>
              ))}
              <circle cx={fd.x} cy={fd.yTop} r={2.6 * k} fill="#f8fafc" />
              {fd.yNa != null && (
                <circle cx={fd.x} cy={fd.yNa} r={2.8 * k} fill="#38bdf8">
                  <title>NA · {fmt(fd.f.na_m, 1)} m</title>
                </circle>
              )}
              {sel && (
                <text
                  x={fd.x}
                  y={fd.yTop - 6 * k}
                  fontSize={9 * k}
                  fill="#f8fafc"
                  stroke="#0f172a"
                  strokeWidth={0.6 * k}
                  paintOrder="stroke"
                  textAnchor="middle"
                >
                  {fd.f.id}
                </text>
              )}
              {!sel && (
                <title>
                  {fd.f.id} · {TIPO_LABEL[fd.f.tipo] ?? fd.f.tipo}
                  {fd.f.prof_m != null ? ` · ${fmt(fd.f.prof_m, 1)} m` : ""}
                </title>
              )}
            </g>
          );
        })}
      </svg>
      </div>
    </div>
  );
}

/* ── detalhe do furo selecionado (camadas) ─────────────── */
function FuroDetalhe({ furo }: { furo: MtpSondagemPerfil }) {
  return (
    <div className="border-t border-border px-4 py-2.5">
      <p className="text-sm font-medium flex items-center gap-2 flex-wrap">
        {furo.id}
        <span className="text-[11px] text-muted-foreground font-normal">
          {TIPO_LABEL[furo.tipo] ?? furo.tipo}
          {furo.cota_topo_m != null && ` · cota ${fmt(furo.cota_topo_m, 2)} m`}
          {furo.prof_m != null && ` · prof ${fmt(furo.prof_m, 1)} m`}
          {furo.afast_m != null &&
            ` · afast ${fmt(furo.afast_m, 1)} m${furo.lado ? " " + furo.lado : ""}`}
          {furo.na_m != null
            ? ` · NA ${fmt(furo.na_m, 1)} m`
            : furo.na_seco
              ? " · seco"
              : ""}
          {furo.impenetravel_m != null && ` · impenetrável ${fmt(furo.impenetravel_m, 1)} m`}
        </span>
      </p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="pr-3 py-1">Prof. (m)</th>
              <th className="pr-3 py-1">Material</th>
              <th className="pr-3 py-1">Formação</th>
              <th className="pr-3 py-1 text-right">SPT</th>
              <th className="pr-3 py-1 text-right">Cat.</th>
            </tr>
          </thead>
          <tbody>
            {furo.camadas.map((c, i) => (
              <tr key={i} className="border-t border-border align-top">
                <td className="pr-3 py-1 whitespace-nowrap tabular-nums">
                  {fmt(c.de_m, 1)}–{fmt(c.a_m, 1)}
                </td>
                <td className="pr-3 py-1">{c.material || "—"}</td>
                <td className="pr-3 py-1 text-muted-foreground">{c.formacao || "—"}</td>
                <td
                  className={`pr-3 py-1 text-right tabular-nums ${
                    c.n_spt == null
                      ? "text-muted-foreground"
                      : c.n_spt <= 4
                        ? "text-amber-400"
                        : c.n_spt >= 50
                          ? "text-rose-400"
                          : ""
                  }`}
                >
                  {c.n_spt ?? "—"}
                </td>
                <td
                  className="pr-3 py-1 text-right font-medium"
                  style={{ color: c.categoria ? COR_CAT[c.categoria] : undefined }}
                >
                  {c.categoria ? `${c.categoria}ª` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── <pattern> de hachura por material (fundo tingido + símbolo) ── */
function MaterialPattern({
  id,
  cor,
  pat,
}: {
  id: string;
  cor: string;
  pat: PatKind;
}) {
  const size = 8;
  const bg = (
    <rect width={size} height={size} fill={cor} fillOpacity={0.16} />
  );
  let mark: ReactNode = null;
  if (pat === "dashes") {
    mark = <line x1={0} y1={4} x2={size} y2={4} stroke={cor} strokeWidth={0.8} />;
  } else if (pat === "diagonal") {
    mark = <line x1={0} y1={size} x2={size} y2={0} stroke={cor} strokeWidth={0.8} />;
  } else if (pat === "cross") {
    mark = (
      <>
        <line x1={0} y1={size} x2={size} y2={0} stroke={cor} strokeWidth={0.7} />
        <line x1={0} y1={0} x2={size} y2={size} stroke={cor} strokeWidth={0.7} />
      </>
    );
  } else if (pat === "dots") {
    mark = <circle cx={4} cy={4} r={1} fill={cor} />;
  } else if (pat === "dots-sparse") {
    mark = <circle cx={4} cy={4} r={0.8} fill={cor} fillOpacity={0.8} />;
  } else if (pat === "vees") {
    mark = (
      <path d={`M1 6 L4 2 L7 6`} fill="none" stroke={cor} strokeWidth={0.8} />
    );
  }
  return (
    <pattern
      id={id}
      patternUnits="userSpaceOnUse"
      width={size}
      height={size}
    >
      {bg}
      {mark}
    </pattern>
  );
}
