// =====================================================
// Brückner (mass-haul) — port TypeScript 1:1 de
// manta-hub/backends/shared/manta_shared/bruckner.py
//
// Mantido em paridade com o Python: mesmos epsilons,
// 96 fatias por onda, mediana ponderada por ds, faixas
// DNIT, barreiras e divisão por lacunas. O golden test
// (bruckner.test.ts) compara contra o resultado que o
// hub embutiu no pacote EPR — se um dos lados mudar
// sozinho, o teste quebra.
// =====================================================

export interface BrucknerBinInput {
  sta_a: number;
  sta_b: number;
  v_corte?: number;
  v_aterro?: number;
}

export interface BrucknerWave {
  sta_start: number;
  sta_end: number;
  direction: 'avante' | 'ré';
  closed: boolean;
  volume_compensado: number;
  momento_m3km: number;
  momento_compensado_m3km: number;
  dmt_m: number | null;
  faixas: Record<string, number>;
  faixas_momento: Record<string, number>;
}

export interface BrucknerSegment {
  sta_start: number;
  sta_end: number;
  reason_start: string;
  reason_end: string;
  baseline: number;
  waves: BrucknerWave[];
  v_corte: number;
  v_aterro: number;
  residual_m3: number;
  volume_compensado: number;
  momento_m3km: number;
  dmt_medio_m: number | null;
}

export interface BrucknerResult {
  params: {
    fill_factor: number;
    baseline: string | number;
    barriers: number[];
    gap_split_m: number;
    n_bins: number;
  };
  segments: BrucknerSegment[];
  curve: [number, number][];
  totals: {
    v_corte: number;
    v_aterro: number;
    volume_compensado: number;
    momento_m3km: number;
    sobra_bota_fora: number;
    falta_emprestimo: number;
    dmt_medio_m: number | null;
  };
  faixas: Record<string, number>;
  faixas_momento: Record<string, number>;
  warnings: string[];
}

export interface AnalyzeBrucknerOptions {
  fillFactor?: number;
  baseline?: 'start' | 'median' | 'auto' | number;
  barriers?: number[];
  gapSplitM?: number;
  dmtFaixas?: [number, number][];
}

export const DEFAULT_DMT_FAIXAS: [number, number][] = [
  [0, 50], [50, 200], [200, 400], [400, 600],
  [600, 800], [800, 1000], [1000, 1200], [1200, 1400],
  [1400, 1600], [1600, 1800], [1800, 2000], [2000, 3000],
  [3000, 5000], [5000, Infinity],
];

const LEVEL_SLICES = 96;

// piece = [s0, s1, d0, d1] com |dev| ≥ 0 linear no trecho
type Piece = [number, number, number, number];

const round = (v: number, dec: number): number => {
  const f = 10 ** dec;
  return Math.round(v * f) / f;
};

function faixaLabel(lo: number, hi: number): string {
  if (hi === Infinity) return `${lo.toFixed(0)}+`;
  return `${lo.toFixed(0)}-${hi.toFixed(0)}`;
}

function faixaFor(dist: number, faixas: [number, number][]): string {
  for (const [lo, hi] of faixas) {
    if ((lo <= dist && dist < hi) || (hi === Infinity && dist >= lo)) {
      return faixaLabel(lo, hi);
    }
  }
  const last = faixas[faixas.length - 1];
  return faixaLabel(last[0], last[1]);
}

/** Medida de {s : dev(s) ≥ h} sobre as peças lineares. */
function chordLength(pieces: Piece[], h: number): number {
  let total = 0;
  for (const [s0, s1, d0, d1] of pieces) {
    if (d0 >= h && d1 >= h) {
      total += s1 - s0;
    } else if (d0 < h && d1 < h) {
      continue;
    } else {
      const t = (h - d0) / (d1 - d0);
      if (d1 >= h) total += (s1 - s0) * (1 - t);
      else total += (s1 - s0) * t;
    }
  }
  return total;
}

function analyzeWave(
  pieces: Piece[],
  direction: 'avante' | 'ré',
  faixas: [number, number][],
): BrucknerWave {
  const staStart = pieces[0][0];
  const staEnd = pieces[pieces.length - 1][1];
  let peak = 0;
  for (const p of pieces) peak = Math.max(peak, p[2], p[3]);
  const devA = pieces[0][2];
  const devB = pieces[pieces.length - 1][3];
  const lo = Math.max(devA, devB);
  const closed = lo < 1e-9;
  let momento = 0;
  for (const [s0, s1, d0, d1] of pieces) momento += ((s1 - s0) * (d0 + d1)) / 2;

  const volumeComp = Math.max(peak - lo, 0);
  const faixaVol: Record<string, number> = {};
  const faixaMom: Record<string, number> = {};
  let momentoComp = 0;
  if (volumeComp > 1e-9) {
    const dh = volumeComp / LEVEL_SLICES;
    for (let k = 0; k < LEVEL_SLICES; k++) {
      const h = lo + (k + 0.5) * dh;
      const chord = chordLength(pieces, h);
      if (chord <= 0) continue;
      const label = faixaFor(chord, faixas);
      faixaVol[label] = (faixaVol[label] ?? 0) + dh;
      faixaMom[label] = (faixaMom[label] ?? 0) + (chord * dh) / 1000;
      momentoComp += chord * dh;
    }
  }
  const dmt = volumeComp > 1e-9 ? momentoComp / volumeComp : null;
  const roundRecord = (rec: Record<string, number>, dec: number) =>
    Object.fromEntries(Object.entries(rec).map(([k, v]) => [k, round(v, dec)]));
  return {
    sta_start: staStart,
    sta_end: staEnd,
    direction,
    closed,
    volume_compensado: volumeComp,
    momento_m3km: momento / 1000,
    momento_compensado_m3km: momentoComp / 1000,
    dmt_m: dmt,
    faixas: roundRecord(faixaVol, 3),
    faixas_momento: roundRecord(faixaMom, 5),
  };
}

/** Divide a polilinha de desvios nos cruzamentos de zero e analisa cada onda. */
function segmentWaves(
  stas: number[],
  devs: number[],
  faixas: [number, number][],
): BrucknerWave[] {
  const waves: BrucknerWave[] = [];
  let cur: Piece[] = [];
  let curSign = 0;

  const flush = () => {
    if (cur.length && cur.some((p) => p[2] > 1e-9 || p[3] > 1e-9)) {
      const direction = curSign > 0 ? 'avante' : 'ré';
      waves.push(analyzeWave(cur, direction, faixas));
    }
    cur = [];
    curSign = 0;
  };

  for (let i = 0; i < stas.length - 1; i++) {
    const s0 = stas[i];
    const s1 = stas[i + 1];
    const d0 = devs[i];
    const d1 = devs[i + 1];
    if (s1 <= s0) continue;
    if (d0 * d1 < -1e-12) {
      const t = d0 / (d0 - d1);
      const sx = s0 + (s1 - s0) * t;
      const sign0 = d0 > 0 ? 1 : -1;
      if (curSign !== 0 && curSign !== sign0) flush();
      curSign = curSign || sign0;
      cur.push([s0, sx, Math.abs(d0), 0]);
      flush();
      curSign = d1 > 0 ? 1 : -1;
      cur.push([sx, s1, 0, Math.abs(d1)]);
    } else {
      const soma = d0 + d1;
      const signPiece = soma > 0 ? 1 : soma < 0 ? -1 : 0;
      if (signPiece === 0) {
        flush();
        continue;
      }
      if (curSign !== 0 && curSign !== signPiece) flush();
      curSign = curSign || signPiece;
      cur.push([s0, s1, Math.abs(d0), Math.abs(d1)]);
    }
  }
  flush();
  return waves;
}

/** Mediana ponderada por ds (aprox. por ponto médio das peças). */
function weightedMedian(stas: number[], ys: number[]): number {
  const items: [number, number][] = [];
  for (let i = 0; i < stas.length - 1; i++) {
    const ds = stas[i + 1] - stas[i];
    if (ds > 0) items.push([(ys[i] + ys[i + 1]) / 2, ds]);
  }
  if (!items.length) return 0;
  items.sort((a, b) => a[0] - b[0]);
  const half = items.reduce((a, [, w]) => a + w, 0) / 2;
  let acc = 0;
  for (const [v, w] of items) {
    acc += w;
    if (acc >= half) return v;
  }
  return items[items.length - 1][0];
}

interface NormBin {
  sta_a: number;
  sta_b: number;
  v_corte: number;
  v_aterro: number;
}

/** Reamostra bins arbitrários (possivelmente sobrepostos) numa grade uniforme. */
export function rebinBins(
  bins: BrucknerBinInput[],
  width = 20,
  minCoverage = 0.25,
): NormBin[] {
  const norm = bins
    .map((b) => ({
      sta_a: b.sta_a, sta_b: b.sta_b,
      v_corte: b.v_corte ?? 0, v_aterro: b.v_aterro ?? 0,
    }))
    .filter((b) => b.sta_b > b.sta_a);
  if (!norm.length) return [];
  const lo = Math.min(...norm.map((b) => b.sta_a));
  const hi = Math.max(...norm.map((b) => b.sta_b));
  const i0 = Math.floor(lo / width);
  const n = Math.ceil(hi / width) - i0;
  const acc: [number, number, number][] = Array.from({ length: n }, () => [0, 0, 0]);
  for (const b of norm) {
    const span = b.sta_b - b.sta_a;
    const j0 = Math.max(Math.floor(b.sta_a / width) - i0, 0);
    const j1 = Math.min(Math.ceil(b.sta_b / width) - i0, n);
    for (let j = j0; j < j1; j++) {
      const g0 = (i0 + j) * width;
      const g1 = g0 + width;
      const ov = Math.min(b.sta_b, g1) - Math.max(b.sta_a, g0);
      if (ov <= 0) continue;
      const f = ov / span;
      acc[j][0] += b.v_corte * f;
      acc[j][1] += b.v_aterro * f;
      acc[j][2] += ov;
    }
  }
  const out: NormBin[] = [];
  for (let j = 0; j < n; j++) {
    const [vc, va, cov] = acc[j];
    if (Math.min(cov, width) < minCoverage * width) continue;
    const g0 = (i0 + j) * width;
    out.push({ sta_a: g0, sta_b: g0 + width, v_corte: vc, v_aterro: va });
  }
  return out;
}

/** Análise completa de mass-haul sobre bins ordenados por estação. */
export function analyzeBruckner(
  bins: BrucknerBinInput[],
  options: AnalyzeBrucknerOptions = {},
): BrucknerResult {
  const fillFactor = options.fillFactor ?? 1.0;
  const baseline = options.baseline ?? 'start';
  const barriers = options.barriers ?? [];
  const gapSplitM = options.gapSplitM ?? 200;
  const dmtFaixas = options.dmtFaixas ?? DEFAULT_DMT_FAIXAS;

  const warnings: string[] = [];
  const norm: NormBin[] = bins
    .map((b) => ({
      sta_a: b.sta_a, sta_b: b.sta_b,
      v_corte: b.v_corte ?? 0, v_aterro: b.v_aterro ?? 0,
    }))
    .filter((b) => b.sta_b > b.sta_a)
    .sort((a, b) => a.sta_a - b.sta_a);
  if (!norm.length) {
    return {
      params: { fill_factor: fillFactor, baseline, barriers: [...barriers].sort((a, b) => a - b),
                gap_split_m: gapSplitM, n_bins: 0 },
      segments: [], curve: [],
      totals: { v_corte: 0, v_aterro: 0, volume_compensado: 0, momento_m3km: 0,
                sobra_bota_fora: 0, falta_emprestimo: 0, dmt_medio_m: null },
      faixas: {}, faixas_momento: {}, warnings: ['sem bins'],
    };
  }

  let prevB: number | null = null;
  for (const b of norm) {
    if (prevB !== null && b.sta_a < prevB - 1e-6) {
      warnings.push(`bins sobrepostos em ${b.sta_a.toFixed(1)}`);
    }
    prevB = b.sta_b;
  }

  // Fronteiras de segmento: barreiras + lacunas grandes.
  const cuts = Array.from(new Set(barriers)).sort((a, b) => a - b);
  const segBins: [NormBin[], string, string][] = [];
  let cur: NormBin[] = [];
  let reasonStart = 'inicio';
  for (const b of norm) {
    if (cur.length) {
      const last = cur[cur.length - 1];
      const hole = b.sta_a - last.sta_b;
      const crossingBarrier = cuts.find(
        (c) => last.sta_b - 1e-6 <= c && c <= b.sta_a + 1e-6,
      );
      if (crossingBarrier !== undefined) {
        segBins.push([cur, reasonStart, 'barreira']);
        cur = [];
        reasonStart = 'barreira';
      } else if (hole > gapSplitM) {
        warnings.push(`lacuna de ${hole.toFixed(0)} m em ${last.sta_b.toFixed(0)} — segmento dividido`);
        segBins.push([cur, reasonStart, 'lacuna']);
        cur = [];
        reasonStart = 'lacuna';
      }
    }
    const inner = cuts.filter((c) => b.sta_a + 1e-6 < c && c < b.sta_b - 1e-6);
    if (inner.length) {
      const c = inner[0];
      const f1 = (c - b.sta_a) / (b.sta_b - b.sta_a);
      cur.push({ sta_a: b.sta_a, sta_b: c, v_corte: b.v_corte * f1, v_aterro: b.v_aterro * f1 });
      segBins.push([cur, reasonStart, 'barreira']);
      cur = [];
      reasonStart = 'barreira';
      cur.push({ sta_a: c, sta_b: b.sta_b,
                 v_corte: b.v_corte * (1 - f1), v_aterro: b.v_aterro * (1 - f1) });
    } else {
      cur.push(b);
    }
  }
  if (cur.length) segBins.push([cur, reasonStart, 'fim']);

  const segments: BrucknerSegment[] = [];
  const curveGlobal: [number, number][] = [];
  let yCarry = 0;
  const tot = {
    v_corte: 0, v_aterro: 0, volume_compensado: 0, momento_m3km: 0,
    sobra_bota_fora: 0, falta_emprestimo: 0,
  };
  const faixasTot: Record<string, number> = {};
  const faixasMomTot: Record<string, number> = {};

  for (const [sbins, rStart, rEnd] of segBins) {
    const stas: number[] = [sbins[0].sta_a];
    const ys: number[] = [0];
    let vC = 0;
    let vA = 0;
    for (const b of sbins) {
      if (b.sta_a > stas[stas.length - 1] + 1e-9) {
        stas.push(b.sta_a);
        ys.push(ys[ys.length - 1]);
      }
      const dy = b.v_corte - fillFactor * b.v_aterro;
      stas.push(b.sta_b);
      ys.push(ys[ys.length - 1] + dy);
      vC += b.v_corte;
      vA += b.v_aterro;
    }

    let c: number;
    if (baseline === 'start') c = 0;
    else if (baseline === 'median' || baseline === 'auto') c = weightedMedian(stas, ys);
    else c = Number(baseline);

    const devs = ys.map((y) => y - c);
    const waves = segmentWaves(stas, devs, dmtFaixas);
    const momento = waves.reduce((a, w) => a + w.momento_m3km, 0);
    const vComp = waves.reduce((a, w) => a + w.volume_compensado, 0);
    const residual = ys[ys.length - 1] - ys[0];
    const moved = vComp + Math.abs(residual);
    segments.push({
      sta_start: stas[0],
      sta_end: stas[stas.length - 1],
      reason_start: rStart,
      reason_end: rEnd,
      baseline: c,
      waves,
      v_corte: vC,
      v_aterro: vA,
      residual_m3: residual,
      volume_compensado: vComp,
      momento_m3km: momento,
      dmt_medio_m: moved > 1e-9 ? (momento * 1000) / moved : null,
    });

    for (const w of waves) {
      for (const [k, v] of Object.entries(w.faixas)) faixasTot[k] = (faixasTot[k] ?? 0) + v;
      for (const [k, v] of Object.entries(w.faixas_momento)) {
        faixasMomTot[k] = (faixasMomTot[k] ?? 0) + v;
      }
    }

    for (let i = 0; i < stas.length; i++) curveGlobal.push([stas[i], ys[i] + yCarry]);
    yCarry += ys[ys.length - 1];

    tot.v_corte += vC;
    tot.v_aterro += vA;
    tot.volume_compensado += vComp;
    tot.momento_m3km += momento;
    if (residual > 0) tot.sobra_bota_fora += residual;
    else tot.falta_emprestimo += -residual;
  }

  const movedTot = tot.volume_compensado + tot.sobra_bota_fora + tot.falta_emprestimo;
  const dmtMedio = movedTot > 1e-9 ? (tot.momento_m3km * 1000) / movedTot : null;

  let curve = curveGlobal;
  if (curve.length > 2000) {
    const step = curve.length / 2000;
    const sampled: [number, number][] = [];
    for (let i = 0; i < 2000; i++) sampled.push(curve[Math.floor(i * step)]);
    sampled.push(curve[curve.length - 1]);
    curve = sampled;
  }

  const roundRecord = (rec: Record<string, number>, dec: number) =>
    Object.fromEntries(
      Object.entries(rec).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, round(v, dec)]),
    );

  return {
    params: {
      fill_factor: fillFactor,
      baseline: typeof baseline === 'string' ? baseline : Number(baseline),
      barriers: Array.from(new Set(barriers)).sort((a, b) => a - b),
      gap_split_m: gapSplitM,
      n_bins: norm.length,
    },
    segments,
    curve: curve.map(([s, y]) => [round(s, 3), round(y, 3)] as [number, number]),
    totals: {
      v_corte: round(tot.v_corte, 3),
      v_aterro: round(tot.v_aterro, 3),
      volume_compensado: round(tot.volume_compensado, 3),
      momento_m3km: round(tot.momento_m3km, 3),
      sobra_bota_fora: round(tot.sobra_bota_fora, 3),
      falta_emprestimo: round(tot.falta_emprestimo, 3),
      dmt_medio_m: dmtMedio == null ? null : round(dmtMedio, 3),
    },
    faixas: roundRecord(faixasTot, 3),
    faixas_momento: roundRecord(faixasMomTot, 5),
    warnings,
  };
}
