/**
 * SecaoTransversalSVG — seção transversal do pacote v2: terreno natural ×
 * plataforma de terraplenagem com hachura de corte (laranja) / aterro
 * (verde), cotas reais, linha de eixo e overlay do ALARGAMENTO de corte
 * (premissa % → faixa extra âmbar nos bordos em corte).
 */
import { useMemo } from "react";
import { fmt } from "../../../lib/format";
import { interpLinha, secaoBounds } from "../../../lib/mtp-geometry";
import type { MtpGeoSecao, MtpSondagem } from "../../../lib/mtp";

const COR_TERRENO = "#10b981";
const COR_PLATAFORMA = "#ef4444";
const COR_CORTE = "#f97316";
const COR_ATERRO = "#22c55e";
const COR_ALARG = "#f59e0b";
const COR_CAT: Record<number, string> = { 1: "#34d399", 2: "#f59e0b", 3: "#f43f5e" };

/** Furo de sondagem próximo à seção (desenhado na posição do offset). */
export interface FuroSecao {
  sondagem: MtpSondagem;
  /** |sta furo − sta seção| em m */
  dist_m: number;
}

function toPares(flat: number[]): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) out.push([flat[i], flat[i + 1]]);
  return out;
}

export function SecaoTransversalSVG({
  secao,
  zOffset,
  exagero = 1,
  alargamentoPct = 0,
  furo = null,
  largura = 860,
  altura = 340,
}: {
  secao: MtpGeoSecao;
  /** z_offset_m do bloco geometria (cotas reais nos rótulos). */
  zOffset: number;
  exagero?: number;
  /** fração 0–1 — overlay de alargamento de corte (jazida na faixa). */
  alargamentoPct?: number;
  /** Sondagem próxima — coluna de camadas por categoria + NA no offset do furo. */
  furo?: FuroSecao | null;
  largura?: number;
  altura?: number;
}) {
  const geom = useMemo(() => {
    const terreno = toPares(secao.terreno);
    const plataforma = toPares(secao.plataforma);
    if (terreno.length < 2 || plataforma.length < 2) return null;

    const b = secaoBounds(secao);
    const spanOff = Math.max(b.offMax - b.offMin, 1);
    const spanZ = Math.max(b.zMax - b.zMin, 0.5);
    const pad = 44;
    const w = largura - pad * 2;
    const h = altura - pad * 2;
    const sx = w / spanOff;
    const sy = (h / spanZ) * exagero;
    const zMid = (b.zMin + b.zMax) / 2;
    const X = (o: number) => pad + (o - b.offMin) * sx;
    const Y = (z: number) => pad + h / 2 - (z - zMid) * sy;

    // hachura corte/aterro entre as duas linhas (split no cruzamento)
    const breaks = new Set<number>();
    for (const [o] of terreno) breaks.add(o);
    for (const [o] of plataforma) breaks.add(o);
    const lo = Math.max(terreno[0][0], plataforma[0][0]);
    const hi = Math.min(
      terreno[terreno.length - 1][0],
      plataforma[plataforma.length - 1][0],
    );
    const xs = [...breaks].filter((o) => o >= lo && o <= hi).sort((a, c) => a - c);

    const quads: { pts: string; corte: boolean }[] = [];
    const mk = (
      a: number, ta: number, da: number,
      c: number, tc: number, dc: number,
      corte: boolean,
    ) =>
      quads.push({
        pts: `${X(a)},${Y(ta)} ${X(c)},${Y(tc)} ${X(c)},${Y(dc)} ${X(a)},${Y(da)}`,
        corte,
      });
    let larguraCorte = 0;
    let corteOffMin = Infinity;
    let corteOffMax = -Infinity;
    for (let i = 0; i < xs.length - 1; i++) {
      const oL = xs[i];
      const oR = xs[i + 1];
      const tL = interpLinha(secao.terreno, oL);
      const tR = interpLinha(secao.terreno, oR);
      const dL = interpLinha(secao.plataforma, oL);
      const dR = interpLinha(secao.plataforma, oR);
      if (tL == null || tR == null || dL == null || dR == null) continue;
      const fL = tL - dL;
      const fR = tR - dR;
      const registra = (o0: number, o1: number, corte: boolean) => {
        if (corte) {
          larguraCorte += o1 - o0;
          corteOffMin = Math.min(corteOffMin, o0);
          corteOffMax = Math.max(corteOffMax, o1);
        }
      };
      if (fL * fR < 0) {
        const xc = oL + ((oR - oL) * Math.abs(fL)) / (Math.abs(fL) + Math.abs(fR));
        const tc = interpLinha(secao.terreno, xc) ?? 0;
        const dc = interpLinha(secao.plataforma, xc) ?? 0;
        mk(oL, tL, dL, xc, tc, dc, fL > 0);
        registra(oL, xc, fL > 0);
        mk(xc, tc, dc, oR, tR, dR, fR > 0);
        registra(xc, oR, fR > 0);
      } else if (Math.abs(fL) > 1e-6 || Math.abs(fR) > 1e-6) {
        mk(oL, tL, dL, oR, tR, dR, fL + fR >= 0);
        registra(oL, oR, fL + fR >= 0);
      }
    }

    const path = (pares: [number, number][]) =>
      pares
        .map(([o, z], i) => `${i ? "L" : "M"}${X(o).toFixed(1)},${Y(z).toFixed(1)}`)
        .join(" ");

    // Overlay do alargamento: banda extra além do bordo em CORTE
    const alarg: { x0: number; x1: number; lado: string }[] = [];
    const dOff = alargamentoPct > 0 && larguraCorte > 0.5
      ? (alargamentoPct * larguraCorte) / 2
      : 0;
    if (dOff > 0) {
      const eps = spanOff * 0.02;
      if (corteOffMin <= lo + eps) {
        alarg.push({ x0: X(b.offMin - 0), x1: X(Math.max(b.offMin, corteOffMin - dOff)), lado: "esq" });
      }
      if (corteOffMax >= hi - eps) {
        alarg.push({ x0: X(Math.min(b.offMax, corteOffMax + dOff)), x1: X(b.offMax), lado: "dir" });
      }
      // fallback: corte interno (sem bordo) — bandas coladas ao trecho de corte
      if (!alarg.length && Number.isFinite(corteOffMin)) {
        alarg.push({ x0: X(corteOffMin - dOff), x1: X(corteOffMin), lado: "esq" });
        alarg.push({ x0: X(corteOffMax), x1: X(corteOffMax + dOff), lado: "dir" });
      }
    }

    // régua de cotas (3 ticks) e de offsets
    const zTicks = [b.zMin, (b.zMin + b.zMax) / 2, b.zMax];
    const offTicks: number[] = [];
    const stepOff = spanOff > 120 ? 40 : spanOff > 60 ? 20 : 10;
    for (let o = Math.ceil(b.offMin / stepOff) * stepOff; o <= b.offMax; o += stepOff) {
      offTicks.push(o);
    }

    return {
      quads,
      terrenoPath: path(terreno),
      plataformaPath: path(plataforma),
      cx: X(0),
      yTop: Y(b.zMax),
      yBot: Y(b.zMin),
      X,
      Y,
      zTicks,
      offTicks,
      alarg,
      dOff,
      larguraCorte,
    };
  }, [secao, exagero, alargamentoPct, largura, altura]);

  const furoDraw = useMemo(() => {
    if (!furo || !geom) return null;
    const s = furo.sondagem;
    if (s.offset_m == null) return null;
    const b = secaoBounds(secao);
    const off = Math.min(Math.max(s.offset_m, b.offMin), b.offMax);
    const zTop =
      interpLinha(secao.terreno, off) ??
      (s.cota_m != null ? s.cota_m - zOffset : null);
    if (zTop == null) return null;
    const prof =
      s.prof_total_m ??
      (s.camadas.length ? Math.max(...s.camadas.map((c) => c.a_m)) : 3);
    const yMax = altura - 26; // não desenha por cima da régua de offsets
    const clampY = (y: number) => Math.min(y, yMax);
    const segs = s.camadas
      .map((c) => ({
        y0: clampY(geom.Y(zTop - c.de_m)),
        y1: clampY(geom.Y(zTop - c.a_m)),
        cor: COR_CAT[c.categoria ?? 0] ?? "#64748b",
        titulo: `${fmt(c.de_m, 1)}–${fmt(c.a_m, 1)} m · N=${c.n_spt ?? "—"} · ${c.material}`,
      }))
      .filter((sg) => sg.y1 > sg.y0 + 0.5);
    const yBot = clampY(geom.Y(zTop - prof));
    return {
      x: geom.X(off),
      yTop: geom.Y(zTop),
      yBot,
      truncado: geom.Y(zTop - prof) > yMax,
      segs,
      na: s.na_m != null ? clampY(geom.Y(zTop - s.na_m)) : null,
      id: s.id,
      dist: furo.dist_m,
      offReal: s.offset_m,
      clamped: off !== s.offset_m,
    };
  }, [furo, geom, secao, zOffset, altura]);

  if (!geom) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
        Seção sem linhas suficientes
      </div>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${largura} ${altura}`}
      className="w-full h-auto bg-slate-900 rounded-lg"
    >
      {/* hachuras corte/aterro */}
      {geom.quads.map((q, i) => (
        <polygon
          key={i}
          points={q.pts}
          fill={q.corte ? COR_CORTE : COR_ATERRO}
          fillOpacity={0.35}
        />
      ))}
      {/* overlay alargamento */}
      {geom.alarg.map((a, i) => (
        <g key={`al-${i}`}>
          <rect
            x={Math.min(a.x0, a.x1)}
            y={geom.yTop}
            width={Math.abs(a.x1 - a.x0)}
            height={geom.yBot - geom.yTop}
            fill={COR_ALARG}
            fillOpacity={0.18}
            stroke={COR_ALARG}
            strokeOpacity={0.55}
            strokeDasharray="5 3"
          />
        </g>
      ))}
      {/* linha de eixo */}
      <line
        x1={geom.cx}
        y1={geom.yTop - 8}
        x2={geom.cx}
        y2={geom.yBot + 8}
        stroke="#64748b"
        strokeDasharray="4 4"
      />
      {/* linhas */}
      <path d={geom.terrenoPath} fill="none" stroke={COR_TERRENO} strokeWidth={2} />
      <path d={geom.plataformaPath} fill="none" stroke={COR_PLATAFORMA} strokeWidth={2} />
      {/* cotas (z reais) */}
      {geom.zTicks.map((z) => (
        <g key={z}>
          <text
            x={6}
            y={geom.Y(z) + 3}
            fontSize={10}
            fill="#94a3b8"
          >
            {fmt(z + zOffset, 1)}
          </text>
        </g>
      ))}
      {/* offsets */}
      {geom.offTicks.map((o) => (
        <text
          key={o}
          x={geom.X(o)}
          y={altura - 8}
          textAnchor="middle"
          fontSize={10}
          fill="#64748b"
        >
          {o > 0 ? `+${o}` : o}
        </text>
      ))}
      {/* furo de sondagem próximo (camadas por categoria) */}
      {furoDraw && (
        <g>
          {furoDraw.segs.length === 0 && (
            <line
              x1={furoDraw.x} y1={furoDraw.yTop}
              x2={furoDraw.x} y2={furoDraw.yBot}
              stroke="#94a3b8" strokeWidth={4} strokeOpacity={0.85}
            />
          )}
          {furoDraw.segs.map((sg, i) => (
            <line
              key={i}
              x1={furoDraw.x} y1={sg.y0}
              x2={furoDraw.x} y2={sg.y1}
              stroke={sg.cor} strokeWidth={5} strokeOpacity={0.95}
            >
              <title>{sg.titulo}</title>
            </line>
          ))}
          <circle cx={furoDraw.x} cy={furoDraw.yTop} r={3} fill="#f8fafc" />
          {furoDraw.na != null && (
            <circle cx={furoDraw.x} cy={furoDraw.na} r={3} fill="#38bdf8">
              <title>NA</title>
            </circle>
          )}
          {furoDraw.truncado && (
            <text x={furoDraw.x} y={furoDraw.yBot + 10} textAnchor="middle"
              fontSize={9} fill="#94a3b8">▼</text>
          )}
          <text
            x={furoDraw.x + 7} y={furoDraw.yTop - 6}
            fontSize={10} fill="#e2e8f0"
          >
            {furoDraw.id} ({fmt(furoDraw.dist, 0)} m
            {furoDraw.clamped ? ` · off ${fmt(furoDraw.offReal, 0)}` : ""})
          </text>
        </g>
      )}
      {/* legenda */}
      <text x={10} y={16} fill={COR_TERRENO} fontSize={11}>terreno</text>
      <text x={68} y={16} fill={COR_PLATAFORMA} fontSize={11}>plataforma</text>
      <text x={148} y={16} fill={COR_CORTE} fontSize={11}>corte</text>
      <text x={188} y={16} fill={COR_ATERRO} fontSize={11}>aterro</text>
      {geom.dOff > 0 && (
        <text x={228} y={16} fill={COR_ALARG} fontSize={11}>
          alargamento +{fmt(geom.dOff, 1)} m/lado
        </text>
      )}
      <text x={largura - 10} y={16} textAnchor="end" fill="#94a3b8" fontSize={11}>
        corte {fmt(secao.area_corte, 1)} m² · aterro {fmt(secao.area_aterro, 1)} m²
      </text>
    </svg>
  );
}
