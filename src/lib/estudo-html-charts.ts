// =====================================================
// Geradores de SVG inline dos gráficos do dashboard de
// terraplenagem, para o relatório HTML autocontido
// (estudo-html-export.ts). Portados 1:1 (cores, transforms
// e campos de dados) dos componentes React:
//   BrucknerChart, DiagramaLinearEixos, OrcamentoTab (BarChart),
//   PerfilLongitudinalChart, PlantaEixosSVG, SecaoTransversalSVG.
//
// Funções PURAS que devolvem string SVG. Sem DOM, sem libs.
// =====================================================

import type { BrucknerResult } from "./bruckner";
import { fmt, fmtBRLCompacto } from "./format";
import {
  staToKmLabel,
  type MtpBarreira,
  type MtpGeoEixo,
  type MtpGeometria,
  type MtpPacote,
} from "./mtp";

/* ── Paleta (idêntica aos componentes) ────────────────────── */
export const COR = {
  corte: "#f97316", // laranja
  aterro: "#22c55e", // verde
  terreno: "#10b981",
  plataforma: "#ef4444", // vermelho (greide/plataforma)
  barreira: "#f59e0b", // âmbar (OAE)
  cyan: "#06b6d4",
  cyanClaro: "#22d3ee",
  base: "#64748b", // caso base (cinza)
  regua: "#475569",
  tick: "#94a3b8",
  canvas: "#0f172a", // slate-900
  grid: "#334155", // slate-700
  eixoRodovia: "#06b6d4",
  eixoAcesso: "#a78bfa",
  eixoRotatoria: "#f472b6",
  eixoTransicao: "#94a3b8",
};

const corEixo = (tipo?: string): string =>
  tipo === "acesso"
    ? COR.eixoAcesso
    : tipo === "rotatoria"
      ? COR.eixoRotatoria
      : tipo === "transicao"
        ? COR.eixoTransicao
        : COR.eixoRodovia;

const esc = (v: unknown): string =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** m³ curto para eixos de gráfico (12,3M / 456k / 78). */
function fmtM3(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(0)}k`;
  return v.toFixed(0);
}

function ticks(min: number, max: number, n: number): number[] {
  if (!(max > min)) return [min];
  const out: number[] = [];
  for (let i = 0; i <= n; i++) out.push(min + ((max - min) * i) / n);
  return out;
}

/* ── 1. Curva de Brückner ─────────────────────────────────── */

export function brucknerChartSvg(
  curve: [number, number][] | undefined,
  barreiras: MtpBarreira[],
): string {
  if (!curve || curve.length < 2)
    return '<p class="empty">Sem curva de Brückner no pacote.</p>';
  const W = 1000;
  const H = 320;
  const padL = 66;
  const padR = 20;
  const padT = 14;
  const padB = 30;
  const kms = curve.map((p) => p[0] / 1000);
  const ys = curve.map((p) => p[1]);
  const x0 = Math.min(...kms);
  const x1 = Math.max(...kms);
  const y0 = Math.min(0, ...ys);
  const y1 = Math.max(0, ...ys);
  const px = (km: number) =>
    padL + (x1 > x0 ? (km - x0) / (x1 - x0) : 0) * (W - padL - padR);
  const py = (y: number) =>
    padT + (y1 > y0 ? 1 - (y - y0) / (y1 - y0) : 0.5) * (H - padT - padB);

  const yGrid = ticks(y0, y1, 5)
    .map((y) => {
      const yy = py(y).toFixed(1);
      return `<line x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}" stroke="${COR.grid}" stroke-opacity="0.5" stroke-dasharray="3 3"/><text x="${padL - 6}" y="${(py(y) + 3).toFixed(1)}" text-anchor="end" fill="${COR.tick}" font-size="11">${esc(fmtM3(y))}</text>`;
    })
    .join("");
  const xGrid = ticks(x0, x1, 6)
    .map((km) => {
      const xx = px(km).toFixed(1);
      return `<text x="${xx}" y="${H - 10}" text-anchor="middle" fill="${COR.tick}" font-size="11">${km.toFixed(1)}</text>`;
    })
    .join("");

  const zeroY = py(0).toFixed(1);
  const barras = barreiras
    .filter((b) => b.sta_m / 1000 >= x0 && b.sta_m / 1000 <= x1)
    .map((b) => {
      const x = px(b.sta_m / 1000).toFixed(1);
      return `<line x1="${x}" y1="${padT}" x2="${x}" y2="${H - padB}" stroke="${COR.barreira}" stroke-width="1.25" stroke-dasharray="6 3"/><text x="${x}" y="${padT - 3}" text-anchor="middle" fill="${COR.barreira}" font-size="10">${esc(b.nome || b.tipo)}</text>`;
    })
    .join("");

  const pts = curve.map((p) => `${px(p[0] / 1000).toFixed(1)},${py(p[1]).toFixed(1)}`).join(" ");

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Curva de Brückner">
  <rect x="0" y="0" width="${W}" height="${H}" fill="${COR.canvas}" rx="10"/>
  ${yGrid}${xGrid}
  <line x1="${padL}" y1="${zeroY}" x2="${W - padR}" y2="${zeroY}" stroke="${COR.tick}" stroke-dasharray="4 4"/>
  ${barras}
  <polyline points="${pts}" fill="none" stroke="${COR.cyan}" stroke-width="2"/>
  <text x="${W - padR}" y="${H - 10}" text-anchor="end" fill="${COR.tick}" font-size="11">km</text>
</svg>`;
}

/* ── 2. Composição do orçamento (barras base × ativo) ─────── */

export interface GrupoOrcamento {
  grupo: string;
  base: number;
  ativo: number;
}

export function orcamentoBarsSvg(
  grupos: GrupoOrcamento[],
  mostrarAtivo: boolean,
  ativoNome: string,
): string {
  const W = 1000;
  const H = 280;
  const padL = 84;
  const padR = 16;
  const padT = 30;
  const padB = 34;
  const maxV = Math.max(
    1,
    ...grupos.map((g) => Math.max(g.base, mostrarAtivo ? g.ativo : 0)),
  );
  const py = (v: number) => padT + (1 - v / maxV) * (H - padT - padB);
  const plotH = H - padT - padB;
  const n = grupos.length;
  const slot = (W - padL - padR) / n;
  const nSeries = mostrarAtivo ? 2 : 1;
  const bw = Math.min(46, (slot * 0.62) / nSeries);

  const yGrid = ticks(0, maxV, 4)
    .map((v) => {
      const yy = py(v).toFixed(1);
      return `<line x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}" stroke="${COR.grid}" stroke-opacity="0.4" stroke-dasharray="3 3"/><text x="${padL - 6}" y="${(py(v) + 3).toFixed(1)}" text-anchor="end" fill="${COR.tick}" font-size="11">${esc(fmtBRLCompacto(v))}</text>`;
    })
    .join("");

  const barras = grupos
    .map((g, i) => {
      const cx = padL + slot * i + slot / 2;
      const gap = 4;
      const totalW = nSeries * bw + (nSeries - 1) * gap;
      let x = cx - totalW / 2;
      const parts: string[] = [];
      const bh = (v: number) => Math.max(0, plotH - (py(v) - padT));
      parts.push(
        `<rect x="${x.toFixed(1)}" y="${py(g.base).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh(g.base).toFixed(1)}" rx="3" fill="${COR.base}"><title>${esc(g.grupo)} — caso base: ${esc(fmtBRLCompacto(g.base))}</title></rect>`,
      );
      x += bw + gap;
      if (mostrarAtivo) {
        parts.push(
          `<rect x="${x.toFixed(1)}" y="${py(g.ativo).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh(g.ativo).toFixed(1)}" rx="3" fill="${COR.cyan}"><title>${esc(g.grupo)} — ${esc(ativoNome)}: ${esc(fmtBRLCompacto(g.ativo))}</title></rect>`,
        );
      }
      parts.push(
        `<text x="${cx.toFixed(1)}" y="${H - 14}" text-anchor="middle" fill="${COR.tick}" font-size="11">${esc(g.grupo)}</text>`,
      );
      return parts.join("");
    })
    .join("");

  const legenda = mostrarAtivo
    ? `<rect x="${padL}" y="8" width="12" height="12" rx="2" fill="${COR.base}"/><text x="${padL + 18}" y="18" fill="${COR.tick}" font-size="12">Caso base</text><rect x="${padL + 110}" y="8" width="12" height="12" rx="2" fill="${COR.cyan}"/><text x="${padL + 128}" y="18" fill="${COR.tick}" font-size="12">${esc(ativoNome)}</text>`
    : `<rect x="${padL}" y="8" width="12" height="12" rx="2" fill="${COR.base}"/><text x="${padL + 18}" y="18" fill="${COR.tick}" font-size="12">Caso base</text>`;

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Composição do custo por grupo">
  <rect x="0" y="0" width="${W}" height="${H}" fill="${COR.canvas}" rx="10"/>
  ${legenda}${yGrid}${barras}
</svg>`;
}

/* ── 3. Diagrama linear por eixo + faixa de segmentos ─────── */

function ordenaEixos(pacote: MtpPacote) {
  const peso = (t?: string) => (t === "rodovia" ? 0 : t === "acesso" ? 1 : 2);
  return [...(pacote.eixos ?? [])].sort(
    (a, b) => peso(a.tipo) - peso(b.tipo) || (a.nome ?? "").localeCompare(b.nome ?? ""),
  );
}

function niceStep(alvo: number): number {
  const passos = [100, 200, 500, 1000, 2000, 5000, 10000, 20000];
  for (const p of passos) if (p >= alvo) return p;
  return 20000;
}

function eixoStripSvg(
  eixo: MtpPacote["eixos"][number],
  bins: MtpPacote["bins"],
  barreiras: MtpBarreira[],
): string {
  const W = 1000;
  const principal = eixo.tipo === "rodovia";
  const hMeia = principal ? 34 : 20;
  const yCentro = hMeia + 14;
  const hTotal = yCentro + hMeia + 26;
  const meus = bins
    .filter((b) => b.eixo_id === eixo.id)
    .sort((a, b) => a.sta_a - b.sta_a);
  if (!meus.length) return "";
  const sta0 = Math.min(eixo.sta_inicio_m, meus[0].sta_a);
  const sta1 = Math.max(eixo.sta_fim_m, meus[meus.length - 1].sta_b);
  const span = Math.max(sta1 - sta0, 1);
  const sx = (s: number) => ((s - sta0) / span) * W;
  const vmax = Math.max(1, ...meus.map((b) => Math.max(b.v_corte, b.v_aterro)));

  const barras = meus
    .map((b) => {
      const x = sx(b.sta_a);
      const w = Math.max(sx(b.sta_b) - x, 0.4);
      const hc = (b.v_corte / vmax) * hMeia;
      const ha = (b.v_aterro / vmax) * hMeia;
      return `<rect x="${x.toFixed(1)}" y="${(yCentro - hc).toFixed(1)}" width="${w.toFixed(1)}" height="${hc.toFixed(1)}" fill="${COR.corte}" fill-opacity="0.85"/><rect x="${x.toFixed(1)}" y="${yCentro}" width="${w.toFixed(1)}" height="${ha.toFixed(1)}" fill="${COR.aterro}" fill-opacity="0.85"/>`;
    })
    .join("");

  const barreirasSvg = barreiras
    .filter((b) => b.sta_m >= sta0 && b.sta_m <= sta1)
    .map(
      (b) =>
        `<line x1="${sx(b.sta_m).toFixed(1)}" y1="4" x2="${sx(b.sta_m).toFixed(1)}" y2="${yCentro + hMeia}" stroke="${COR.barreira}" stroke-width="1.25" stroke-dasharray="4 3"/>`,
    )
    .join("");

  const ext = sta1 - sta0;
  const step = niceStep(ext / 8);
  const reguaY = yCentro + hMeia + 4;
  const tks: string[] = [];
  const inicio = Math.ceil(sta0 / step) * step;
  for (let s = inicio; s <= sta1; s += step) {
    const x = sx(s).toFixed(1);
    tks.push(
      `<line x1="${x}" y1="${reguaY}" x2="${x}" y2="${reguaY + 4}" stroke="${COR.regua}"/><text x="${x}" y="${reguaY + 13}" text-anchor="middle" fill="${COR.tick}" font-size="9">${esc(staToKmLabel(s))}</text>`,
    );
  }

  const titulo = `${esc(eixo.nome || eixo.id)} <span class="mut">(${esc(eixo.tipo)} · ${fmt(eixo.extensao_m / 1000, 2)} km · corte ${fmt(eixo.volumes?.corte_total ?? null)} m³ · aterro ${fmt(eixo.volumes?.aterro ?? null)} m³)</span>`;

  return `<div class="strip"><div class="strip-t">${titulo}</div>
<svg viewBox="0 0 ${W} ${hTotal}" class="chart flat" role="img">
  <text x="2" y="10" fill="${COR.corte}" font-size="8.5">CORTE ↑</text>
  <text x="2" y="${yCentro + hMeia - 2}" fill="${COR.aterro}" font-size="8.5">ATERRO ↓</text>
  ${barras}
  <line x1="0" y1="${yCentro}" x2="${W}" y2="${yCentro}" stroke="${COR.regua}" stroke-width="1"/>
  ${barreirasSvg}${tks.join("")}
</svg></div>`;
}

function faixaSegmentosSvg(pacote: MtpPacote, bruckner: BrucknerResult): string {
  const rodovias = (pacote.eixos ?? []).filter((e) => e.tipo === "rodovia");
  if (!rodovias.length || !bruckner.segments?.length) return "";
  const W = 1000;
  const H = 56;
  const sta0 = Math.min(...rodovias.map((e) => e.sta_inicio_m));
  const sta1 = Math.max(...rodovias.map((e) => e.sta_fim_m));
  const span = Math.max(sta1 - sta0, 1);
  const sx = (s: number) => ((s - sta0) / span) * W;
  const segs = bruckner.segments
    .map((s) => {
      const x = sx(s.sta_start);
      const w = Math.max(sx(s.sta_end) - x, 2);
      const sobra = s.residual_m3 >= 0;
      const cor = sobra ? COR.barreira : COR.cyan;
      const rotulo =
        w > 70
          ? `<text x="${(x + w / 2).toFixed(1)}" y="24" text-anchor="middle" fill="${cor}" font-size="8.5">${sobra ? "sobra → BF " : "falta ← EMP "}${esc(fmt(Math.abs(s.residual_m3)))} m³</text>`
          : "";
      return `<rect x="${x.toFixed(1)}" y="10" width="${w.toFixed(1)}" height="22" rx="3" fill="${cor}" fill-opacity="0.14" stroke="${cor}" stroke-opacity="0.5" stroke-width="0.75"><title>${esc(`${staToKmLabel(s.sta_start)}–${staToKmLabel(s.sta_end)} · momento ${fmt(s.momento_m3km)} m³·km · residual ${fmt(s.residual_m3)} m³`)}</title></rect>${rotulo}`;
    })
    .join("");
  const barreirasSvg = (pacote.barreiras ?? [])
    .filter((b) => b.sta_m >= sta0 && b.sta_m <= sta1)
    .map(
      (b) =>
        `<line x1="${sx(b.sta_m).toFixed(1)}" y1="4" x2="${sx(b.sta_m).toFixed(1)}" y2="38" stroke="${COR.barreira}" stroke-width="1.25" stroke-dasharray="4 3"/><text x="${sx(b.sta_m).toFixed(1)}" y="48" text-anchor="middle" fill="${COR.barreira}" font-size="8.5">${esc(b.nome || b.tipo)}</text>`,
    )
    .join("");
  return `<div class="strip"><div class="strip-t">Balanço por segmento (rodovias) — residuais do Brückner</div>
<svg viewBox="0 0 ${W} ${H}" class="chart flat" role="img">${segs}${barreirasSvg}</svg></div>`;
}

export function diagramaLinearSvg(
  pacote: MtpPacote,
  bruckner: BrucknerResult | null,
): string {
  const strips = ordenaEixos(pacote)
    .map((e) => eixoStripSvg(e, pacote.bins ?? [], pacote.barreiras ?? []))
    .filter(Boolean)
    .join("");
  const faixa = bruckner ? faixaSegmentosSvg(pacote, bruckner) : "";
  return strips + faixa;
}

/* ── 4. Perfil longitudinal (terreno + greide) ────────────── */

export function perfilLongitudinalSvg(
  ge: MtpGeoEixo,
  zOffset: number,
  barreiras: MtpBarreira[],
): string {
  const perfil = ge.perfil;
  if (!perfil) return "";
  const g = perfil.greide_z ?? [];
  const t = perfil.terreno_z ?? [];
  const nPts = Math.max(g.length, t.length);
  if (nPts < 2) return "";
  const passo = perfil.passo_m || 1;
  const sta0 = perfil.sta0_m || 0;
  interface P {
    km: number;
    g: number | null;
    t: number | null;
  }
  const pontos: P[] = [];
  for (let i = 0; i < nPts; i++) {
    const gv = g[i];
    const tv = t[i];
    if (gv == null && tv == null) continue;
    pontos.push({
      km: (sta0 + i * passo) / 1000,
      g: gv == null ? null : gv + zOffset,
      t: tv == null ? null : tv + zOffset,
    });
  }
  if (pontos.length < 2) return "";
  const W = 1000;
  const H = 240;
  const padL = 58;
  const padR = 16;
  const padT = 14;
  const padB = 28;
  const kms = pontos.map((p) => p.km);
  const zs = pontos.flatMap((p) => [p.g, p.t].filter((v): v is number => v != null));
  const x0 = Math.min(...kms);
  const x1 = Math.max(...kms);
  const z0 = Math.min(...zs);
  const z1 = Math.max(...zs);
  const px = (km: number) =>
    padL + (x1 > x0 ? (km - x0) / (x1 - x0) : 0) * (W - padL - padR);
  const py = (z: number) =>
    padT + (z1 > z0 ? 1 - (z - z0) / (z1 - z0) : 0.5) * (H - padT - padB);

  const linha = (key: "g" | "t", cor: string) => {
    let d = "";
    let pen = false;
    for (const p of pontos) {
      const v = p[key];
      if (v == null) {
        pen = false;
        continue;
      }
      d += `${pen ? "L" : "M"}${px(p.km).toFixed(1)},${py(v).toFixed(1)} `;
      pen = true;
    }
    return `<path d="${d.trim()}" fill="none" stroke="${cor}" stroke-width="1.75"/>`;
  };

  const yGrid = ticks(z0, z1, 4)
    .map((z) => {
      const yy = py(z).toFixed(1);
      return `<line x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}" stroke="${COR.grid}" stroke-opacity="0.4" stroke-dasharray="3 3"/><text x="${padL - 6}" y="${(py(z) + 3).toFixed(1)}" text-anchor="end" fill="${COR.tick}" font-size="11">${fmt(z, 0)}</text>`;
    })
    .join("");
  const xTicks = ticks(x0, x1, 6)
    .map(
      (km) =>
        `<text x="${px(km).toFixed(1)}" y="${H - 9}" text-anchor="middle" fill="${COR.tick}" font-size="11">km ${Math.round(km)}</text>`,
    )
    .join("");
  const barras = barreiras
    .filter((b) => b.sta_m / 1000 >= x0 && b.sta_m / 1000 <= x1)
    .map(
      (b) =>
        `<line x1="${px(b.sta_m / 1000).toFixed(1)}" y1="${padT}" x2="${px(b.sta_m / 1000).toFixed(1)}" y2="${H - padB}" stroke="${COR.barreira}" stroke-dasharray="4 4"/>`,
    )
    .join("");

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Perfil longitudinal">
  <rect x="0" y="0" width="${W}" height="${H}" fill="${COR.canvas}" rx="10"/>
  ${yGrid}${xTicks}${barras}
  ${linha("t", COR.terreno)}${linha("g", COR.plataforma)}
  <rect x="${W - 168}" y="8" width="10" height="10" fill="${COR.terreno}"/><text x="${W - 154}" y="17" fill="${COR.tick}" font-size="11">terreno</text>
  <rect x="${W - 92}" y="8" width="10" height="10" fill="${COR.plataforma}"/><text x="${W - 78}" y="17" fill="${COR.tick}" font-size="11">greide</text>
</svg>`;
}

/* ── 5. Planta dos eixos (E/N) ────────────────────────────── */

export interface PlantaPonto {
  e: number;
  n: number;
  cor?: string;
  rotulo?: string;
}

export function plantaEixosSvg(
  geometria: MtpGeometria,
  eixos: MtpPacote["eixos"],
  pontos: PlantaPonto[] = [],
): string {
  const W = 900;
  const H = 320;
  const pad = 20;
  const comEn = (geometria.eixos ?? []).filter(
    (ge) => ge.tracado && ge.tracado.en.length >= 4,
  );
  if (!comEn.length) return '<p class="empty">Sem traçado no pacote.</p>';
  let eMin = Infinity;
  let eMax = -Infinity;
  let nMin = Infinity;
  let nMax = -Infinity;
  for (const ge of comEn) {
    const en = ge.tracado!.en;
    for (let i = 0; i < en.length; i += 2) {
      eMin = Math.min(eMin, en[i]);
      eMax = Math.max(eMax, en[i]);
      nMin = Math.min(nMin, en[i + 1]);
      nMax = Math.max(nMax, en[i + 1]);
    }
  }
  const spanE = Math.max(eMax - eMin, 1);
  const spanN = Math.max(nMax - nMin, 1);
  const s = Math.min((W - 2 * pad) / spanE, (H - 2 * pad) / spanN);
  const offX = (W - 2 * pad - spanE * s) / 2;
  const offY = (H - 2 * pad - spanN * s) / 2;
  const X = (e: number) => pad + (e - eMin) * s + offX;
  const Y = (nn: number) => H - pad - (nn - nMin) * s - offY;

  const tipoDe = new Map(eixos.map((e) => [e.id, e.tipo]));
  const paths = comEn
    .map((ge) => {
      const en = ge.tracado!.en;
      // decima para no máx ~500 vértices
      const nv = en.length / 2;
      const stepV = Math.max(1, Math.ceil(nv / 500));
      let d = "";
      for (let i = 0; i < nv; i += stepV) {
        d += `${i === 0 ? "M" : "L"}${X(en[2 * i]).toFixed(1)},${Y(en[2 * i + 1]).toFixed(1)} `;
      }
      const cor = corEixo(tipoDe.get(ge.eixo_id));
      return `<path d="${d.trim()}" fill="none" stroke="${cor}" stroke-width="1.75" stroke-opacity="0.85"><title>${esc(ge.eixo_id)}</title></path>`;
    })
    .join("");

  const pts = pontos
    .map(
      (p) =>
        `<circle cx="${X(p.e).toFixed(1)}" cy="${Y(p.n).toFixed(1)}" r="3" fill="${p.cor ?? "#34d399"}" fill-opacity="0.85"><title>${esc(p.rotulo ?? "")}</title></circle>`,
    )
    .join("");

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Planta dos eixos">
  <rect x="0" y="0" width="${W}" height="${H}" fill="${COR.canvas}" rx="10"/>
  ${paths}${pts}
</svg>`;
}

/* ── 6. Seção transversal (terreno × plataforma) ──────────── */

type Par = [number, number];

function toPares(flat: number[]): Par[] {
  const out: Par[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) out.push([flat[i], flat[i + 1]]);
  return out;
}

function interp(pares: Par[], off: number): number | null {
  if (pares.length === 0) return null;
  if (off < pares[0][0] || off > pares[pares.length - 1][0]) return null;
  for (let i = 0; i + 1 < pares.length; i++) {
    const [oa, za] = pares[i];
    const [ob, zb] = pares[i + 1];
    if (off >= oa && off <= ob) {
      if (ob === oa) return za;
      return za + ((zb - za) * (off - oa)) / (ob - oa);
    }
  }
  return pares[pares.length - 1][1];
}

export interface SecaoLike {
  sta_m: number;
  terreno: number[];
  plataforma: number[];
  area_corte: number;
  area_aterro: number;
}

export function secaoTransversalSvg(secao: SecaoLike, zOffset: number): string {
  const W = 860;
  const H = 340;
  const pad = 44;
  const terreno = toPares(secao.terreno);
  const plataforma = toPares(secao.plataforma);
  const all = [...terreno, ...plataforma];
  if (all.length < 2) return '<p class="empty">Seção sem geometria.</p>';
  let offMin = Infinity;
  let offMax = -Infinity;
  let zMin = Infinity;
  let zMax = -Infinity;
  for (const [o, z] of all) {
    offMin = Math.min(offMin, o);
    offMax = Math.max(offMax, o);
    zMin = Math.min(zMin, z);
    zMax = Math.max(zMax, z);
  }
  const w = W - pad * 2;
  const h = H - pad * 2;
  const spanOff = Math.max(offMax - offMin, 1);
  const spanZ = Math.max(zMax - zMin, 0.5);
  const sx = w / spanOff;
  const sy = h / spanZ;
  const zMid = (zMin + zMax) / 2;
  const X = (o: number) => pad + (o - offMin) * sx;
  const Y = (z: number) => pad + h / 2 - (z - zMid) * sy;

  // Hachura corte/aterro
  let quads = "";
  if (terreno.length >= 2 && plataforma.length >= 2) {
    const lo = Math.max(terreno[0][0], plataforma[0][0]);
    const hi = Math.min(
      terreno[terreno.length - 1][0],
      plataforma[plataforma.length - 1][0],
    );
    if (hi > lo) {
      const xsSet = new Set<number>([lo, hi]);
      for (const [o] of terreno) if (o > lo && o < hi) xsSet.add(o);
      for (const [o] of plataforma) if (o > lo && o < hi) xsSet.add(o);
      const xs = [...xsSet].sort((a, b) => a - b);
      const quad = (
        a: number,
        ta: number,
        da: number,
        b: number,
        tb: number,
        db: number,
        corte: boolean,
      ) =>
        `<polygon points="${X(a).toFixed(1)},${Y(ta).toFixed(1)} ${X(b).toFixed(1)},${Y(tb).toFixed(1)} ${X(b).toFixed(1)},${Y(db).toFixed(1)} ${X(a).toFixed(1)},${Y(da).toFixed(1)}" fill="${corte ? COR.corte : COR.aterro}" fill-opacity="0.35"/>`;
      for (let i = 0; i + 1 < xs.length; i++) {
        const a = xs[i];
        const b = xs[i + 1];
        const ta = interp(terreno, a);
        const tb = interp(terreno, b);
        const da = interp(plataforma, a);
        const db = interp(plataforma, b);
        if (ta == null || tb == null || da == null || db == null) continue;
        const fa = ta - da;
        const fb = tb - db;
        if ((fa >= 0 && fb >= 0) || (fa <= 0 && fb <= 0)) {
          quads += quad(a, ta, da, b, tb, db, fa + fb >= 0);
        } else {
          const xc = a + ((b - a) * fa) / (fa - fb);
          const tc = interp(terreno, xc);
          const dc = interp(plataforma, xc);
          if (tc == null || dc == null) continue;
          quads += quad(a, ta, da, xc, tc, dc, fa >= 0);
          quads += quad(xc, tc, dc, b, tb, db, fb >= 0);
        }
      }
    }
  }

  const linha = (pares: Par[], cor: string) => {
    const d = pares
      .map((p, i) => `${i === 0 ? "M" : "L"}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`)
      .join(" ");
    return `<path d="${d}" fill="none" stroke="${cor}" stroke-width="2"/>`;
  };

  const eixoCentro =
    offMin <= 0 && offMax >= 0
      ? `<line x1="${X(0).toFixed(1)}" y1="${pad - 8}" x2="${X(0).toFixed(1)}" y2="${H - pad + 8}" stroke="${COR.regua}" stroke-dasharray="4 4"/>`
      : "";

  const cotas = [zMin, zMid, zMax]
    .map(
      (z) =>
        `<text x="6" y="${(Y(z) + 3).toFixed(1)}" fill="${COR.tick}" font-size="10">${fmt(z + zOffset, 1)}</text>`,
    )
    .join("");
  const stepOff = spanOff > 120 ? 40 : spanOff > 60 ? 20 : 10;
  const reguaTicks: string[] = [];
  const oIni = Math.ceil(offMin / stepOff) * stepOff;
  for (let o = oIni; o <= offMax; o += stepOff) {
    reguaTicks.push(
      `<text x="${X(o).toFixed(1)}" y="${H - 8}" text-anchor="middle" fill="${COR.regua}" font-size="10">${o > 0 ? "+" + o : o}</text>`,
    );
  }

  const legenda = `<text x="${pad}" y="16" fill="${COR.terreno}" font-size="11">terreno</text><text x="${pad + 60}" y="16" fill="${COR.plataforma}" font-size="11">plataforma</text><text x="${pad + 150}" y="16" fill="${COR.corte}" font-size="11">corte</text><text x="${pad + 200}" y="16" fill="${COR.aterro}" font-size="11">aterro</text><text x="${W - pad}" y="16" text-anchor="end" fill="${COR.tick}" font-size="10">corte ${fmt(secao.area_corte, 1)} m² · aterro ${fmt(secao.area_aterro, 1)} m²</text>`;

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Seção transversal ${esc(staToKmLabel(secao.sta_m))}">
  <rect x="0" y="0" width="${W}" height="${H}" fill="${COR.canvas}" rx="10"/>
  ${legenda}${eixoCentro}${quads}
  ${linha(terreno, COR.terreno)}${linha(plataforma, COR.plataforma)}
  ${cotas}${reguaTicks.join("")}
</svg>`;
}
