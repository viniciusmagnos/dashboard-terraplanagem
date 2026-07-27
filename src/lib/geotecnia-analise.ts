/**
 * Análises geotécnicas derivadas do pacote — puras, client-side.
 *
 * 1) UMIDADE do material escavado: cruza os ensaios de laboratório dos furos
 *    (umidade natural `w_nat_pct` por intervalo de profundidade) com os
 *    volumes de corte por bin de 20 m → m³ por faixa de umidade e trechos
 *    contíguos ("≥50% do km A ao km B: N m³").
 *
 * 2) LITOLOGIA do corte em rocha: cruza os estratos do perfil geológico
 *    (rachuras com litologia + categoria, polígonos em estação×cota) com o
 *    corte por bin → m³ de argilito/arenito/basalto por categoria e por
 *    trecho de km.
 *
 * Mesmo padrão de `perfil-materiais.ts`: nada é persistido no pacote; o
 * export XLSX usa o port Python `manta_shared/geotecnia_analise.py`.
 */
import type {
  MtpBin,
  MtpEstratoGeo,
  MtpGeoPerfil,
  MtpGeometria,
  MtpGeotecnia,
  MtpPerfilEixo,
  MtpSondagem,
} from "./mtp";

/* ════════════════════════ 1. UMIDADE ═══════════════════════ */

/** Limites das faixas (bandas) de umidade natural, em %. */
export const BANDAS_UMIDADE = [20, 30, 40, 50];

/** Rótulo da banda i (0..limites.length) — ex.: "<20", "20–30", "≥50". */
export function rotuloBanda(i: number, limites: number[] = BANDAS_UMIDADE): string {
  if (i <= 0) return `<${limites[0]}%`;
  if (i >= limites.length) return `≥${limites[limites.length - 1]}%`;
  return `${limites[i - 1]}–${limites[i]}%`;
}

/** Banda da umidade w (índice 0..limites.length). */
export function bandaDe(w: number, limites: number[] = BANDAS_UMIDADE): number {
  let b = 0;
  for (const lim of limites) if (w >= lim) b++;
  return b;
}

/** Contribuição de UMA amostra de laboratório ao corte de um bin. */
export interface AmostraBin {
  furo_id: string;
  /** umidade natural (%) */
  w: number;
  /** umidade ótima (%) quando ensaiada */
  w_ot: number | null;
  /** m³ do bin cobertos pela profundidade amostrada */
  v_m3: number;
  /** m³ extrapolados abaixo da amostra mais funda */
  v_extrap_m3: number;
}

export interface UmidadeBinRow {
  eixo_id: string;
  sta_a: number;
  sta_b: number;
  v_corte: number;
  /** profundidade média de corte usada no rateio (m) */
  prof_m: number;
  furo_id: string;
  dist_m: number;
  amostras: AmostraBin[];
  /** m³ dentro da profundidade de corte sem amostra (lacunas) */
  v_sem_ensaio: number;
}

export interface UmidadeEixoAgg {
  eixo_id: string;
  v_corte_total: number;
  /** m³ com umidade conhecida (medido + extrapolado) */
  v_coberto: number;
  v_medido: number;
  v_extrapolado: number;
  v_sem_ensaio: number;
  /** m³ de bins sem furo ensaiado a ≤ maxDist */
  v_sem_furo: number;
  /** m³ por banda (medido + extrapolado), índice = banda */
  porBanda: number[];
  /** w̄ natural ponderado pelo volume coberto */
  w_medio: number | null;
  /** Δ médio w_nat − w_ot (ponderado; só amostras com w_ot) */
  dw_ot: number | null;
  n_bins: number;
  n_furos: number;
}

export interface UmidadeCorte {
  /** limites das bandas usados */
  bandas: number[];
  rows: UmidadeBinRow[];
  porEixo: UmidadeEixoAgg[];
  total: UmidadeEixoAgg;
  n_furos_ensaio: number;
  n_amostras: number;
}

interface EnsaioUtil {
  de: number;
  a: number;
  w: number;
  w_ot: number | null;
}

function ensaiosUteis(furo: MtpSondagem): EnsaioUtil[] {
  const out: EnsaioUtil[] = [];
  for (const e of furo.ensaios ?? []) {
    if (e.w_nat_pct == null || e.prof_de_m == null || e.prof_a_m == null) continue;
    if (e.prof_a_m <= e.prof_de_m) continue;
    out.push({ de: e.prof_de_m, a: e.prof_a_m, w: e.w_nat_pct, w_ot: e.w_ot_pct ?? null });
  }
  out.sort((x, y) => x.de - y.de);
  return out;
}

/** Profundidade de corte no perfil do bloco geometria (terreno − greide). */
function profNoPerfil(perfil: MtpGeoPerfil | null | undefined, sta: number): number | null {
  if (!perfil || !perfil.greide_z.length) return null;
  const i = Math.round((sta - perfil.sta0_m) / perfil.passo_m);
  if (i < 0 || i >= perfil.greide_z.length) return null;
  const zg = perfil.greide_z[i];
  const zt = perfil.terreno_z[i];
  if (zg == null || zt == null) return null;
  return Math.max(0, zt - zg);
}

export interface UmidadeOpts {
  maxDistM?: number;
  bandas?: number[];
}

/**
 * Cruza bins de corte × furos com ensaio → volumes por faixa de umidade.
 * `bins` = `pacote.bins`; `geo` = bloco sondagens; `geometria` p/ fallback
 * de profundidade de corte.
 */
export function umidadeCortePorEixo(
  bins: MtpBin[],
  geo: MtpGeotecnia,
  geometria: MtpGeometria | null | undefined,
  { maxDistM = 300, bandas = BANDAS_UMIDADE }: UmidadeOpts = {},
): UmidadeCorte | null {
  const furosEnsaio = geo.sondagens.filter(
    (s) => s.eixo_id && s.sta_m != null && ensaiosUteis(s).length > 0,
  );
  if (furosEnsaio.length === 0) return null;

  const porEixoFuros = new Map<string, MtpSondagem[]>();
  for (const f of furosEnsaio) {
    const lst = porEixoFuros.get(f.eixo_id!) ?? [];
    lst.push(f);
    porEixoFuros.set(f.eixo_id!, lst);
  }

  // prof_corte_m já computada pelo builder (materiais.bins), por (eixo, sta_a)
  const profBuilder = new Map<string, number>();
  for (const bm of geo.materiais?.bins ?? []) {
    if (bm.prof_corte_m > 0)
      profBuilder.set(`${bm.eixo_id}|${Math.round(bm.sta_a)}`, bm.prof_corte_m);
  }
  const perfilPorEixo = new Map<string, MtpGeoPerfil | null>();
  for (const ge of geometria?.eixos ?? []) perfilPorEixo.set(ge.eixo_id, ge.perfil);

  const rows: UmidadeBinRow[] = [];
  const aggs = new Map<string, UmidadeEixoAgg>();
  const furosUsados = new Map<string, Set<string>>();
  const nb = bandas.length + 1;

  const aggDe = (eixo: string): UmidadeEixoAgg => {
    let a = aggs.get(eixo);
    if (!a) {
      a = {
        eixo_id: eixo, v_corte_total: 0, v_coberto: 0, v_medido: 0,
        v_extrapolado: 0, v_sem_ensaio: 0, v_sem_furo: 0,
        porBanda: new Array(nb).fill(0), w_medio: null, dw_ot: null,
        n_bins: 0, n_furos: 0,
      };
      aggs.set(eixo, a);
      furosUsados.set(eixo, new Set());
    }
    return a;
  };
  // acumuladores p/ médias ponderadas
  const somaW = new Map<string, number>();
  const somaDw = new Map<string, number>();
  const somaVdw = new Map<string, number>();

  for (const bin of bins) {
    if (!(bin.v_corte > 0)) continue;
    const furos = porEixoFuros.get(bin.eixo_id);
    if (!furos) continue; // eixo sem nenhum furo ensaiado — fora do universo
    const agg = aggDe(bin.eixo_id);
    agg.v_corte_total += bin.v_corte;
    agg.n_bins += 1;

    const mid = (bin.sta_a + bin.sta_b) / 2;
    let furo: MtpSondagem | null = null;
    let dist = Infinity;
    for (const f of furos) {
      const d = Math.abs((f.sta_m ?? 0) - mid);
      if (d < dist) { dist = d; furo = f; }
    }
    if (!furo || dist > maxDistM) {
      agg.v_sem_furo += bin.v_corte;
      continue;
    }

    const prof =
      profBuilder.get(`${bin.eixo_id}|${Math.round(bin.sta_a)}`) ??
      profNoPerfil(perfilPorEixo.get(bin.eixo_id), mid) ??
      furo.prof_total_m ??
      0;
    if (!(prof > 0)) {
      agg.v_sem_furo += bin.v_corte;
      continue;
    }

    const ensaios = ensaiosUteis(furo);
    const amostras: AmostraBin[] = [];
    let coberto = 0;
    for (let i = 0; i < ensaios.length; i++) {
      const e = ensaios[i];
      const de = Math.min(e.de, prof);
      const a = Math.min(e.a, prof);
      const t = Math.max(0, a - de);
      // amostra mais funda extrapola até o fundo do corte
      const ultima = i === ensaios.length - 1;
      const tExtra = ultima && prof > e.a ? prof - e.a : 0;
      coberto += t + tExtra;
      if (t + tExtra <= 0) continue;
      amostras.push({
        furo_id: furo.id,
        w: e.w,
        w_ot: e.w_ot,
        v_m3: (bin.v_corte * t) / prof,
        v_extrap_m3: (bin.v_corte * tExtra) / prof,
      });
    }
    const vSem = (bin.v_corte * Math.max(0, prof - coberto)) / prof;
    rows.push({
      eixo_id: bin.eixo_id, sta_a: bin.sta_a, sta_b: bin.sta_b,
      v_corte: bin.v_corte, prof_m: prof, furo_id: furo.id,
      dist_m: Math.round(dist * 10) / 10, amostras, v_sem_ensaio: vSem,
    });

    agg.v_sem_ensaio += vSem;
    furosUsados.get(bin.eixo_id)!.add(furo.id);
    for (const am of amostras) {
      const v = am.v_m3 + am.v_extrap_m3;
      agg.v_medido += am.v_m3;
      agg.v_extrapolado += am.v_extrap_m3;
      agg.v_coberto += v;
      agg.porBanda[bandaDe(am.w, bandas)] += v;
      somaW.set(bin.eixo_id, (somaW.get(bin.eixo_id) ?? 0) + am.w * v);
      if (am.w_ot != null) {
        somaDw.set(bin.eixo_id, (somaDw.get(bin.eixo_id) ?? 0) + (am.w - am.w_ot) * v);
        somaVdw.set(bin.eixo_id, (somaVdw.get(bin.eixo_id) ?? 0) + v);
      }
    }
  }

  if (rows.length === 0) return null;

  const porEixo = [...aggs.values()]
    .filter((a) => a.v_corte_total > 0)
    .sort((a, b) => a.eixo_id.localeCompare(b.eixo_id));
  for (const a of porEixo) {
    a.n_furos = furosUsados.get(a.eixo_id)?.size ?? 0;
    if (a.v_coberto > 0) a.w_medio = (somaW.get(a.eixo_id) ?? 0) / a.v_coberto;
    const vdw = somaVdw.get(a.eixo_id) ?? 0;
    if (vdw > 0) a.dw_ot = (somaDw.get(a.eixo_id) ?? 0) / vdw;
  }

  const total: UmidadeEixoAgg = {
    eixo_id: "TOTAL", v_corte_total: 0, v_coberto: 0, v_medido: 0,
    v_extrapolado: 0, v_sem_ensaio: 0, v_sem_furo: 0,
    porBanda: new Array(nb).fill(0), w_medio: null, dw_ot: null,
    n_bins: 0, n_furos: 0,
  };
  let sw = 0, sdw = 0, svdw = 0;
  const todosFuros = new Set<string>();
  for (const a of porEixo) {
    total.v_corte_total += a.v_corte_total;
    total.v_coberto += a.v_coberto;
    total.v_medido += a.v_medido;
    total.v_extrapolado += a.v_extrapolado;
    total.v_sem_ensaio += a.v_sem_ensaio;
    total.v_sem_furo += a.v_sem_furo;
    total.n_bins += a.n_bins;
    for (let i = 0; i < nb; i++) total.porBanda[i] += a.porBanda[i];
    sw += somaW.get(a.eixo_id) ?? 0;
    sdw += somaDw.get(a.eixo_id) ?? 0;
    svdw += somaVdw.get(a.eixo_id) ?? 0;
    for (const f of furosUsados.get(a.eixo_id) ?? []) todosFuros.add(f);
  }
  total.n_furos = todosFuros.size;
  if (total.v_coberto > 0) total.w_medio = sw / total.v_coberto;
  if (svdw > 0) total.dw_ot = sdw / svdw;

  return {
    bandas, rows, porEixo, total,
    n_furos_ensaio: furosEnsaio.length,
    n_amostras: furosEnsaio.reduce((n, f) => n + ensaiosUteis(f).length, 0),
  };
}

/** Trecho contíguo com volume relevante numa faixa de umidade. */
export interface TrechoUmidade {
  eixo_id: string;
  sta_a: number;
  sta_b: number;
  /** m³ com w ≥ wMin (medido) */
  v_m3: number;
  /** m³ com w ≥ wMin extrapolados */
  v_extrap_m3: number;
  w_min: number;
  w_max: number;
  /** w̄ ponderado pelo volume na faixa */
  w_medio: number;
  furos: string[];
}

/**
 * Agrupa bins contíguos (tolerância de 1 bin) com volume na faixa w ≥ wMin.
 */
export function trechosUmidade(
  rows: UmidadeBinRow[],
  wMin: number,
  { epsM3 = 1, tolBins = 1 }: { epsM3?: number; tolBins?: number } = {},
): TrechoUmidade[] {
  const porEixo = new Map<string, UmidadeBinRow[]>();
  for (const r of rows) {
    const lst = porEixo.get(r.eixo_id) ?? [];
    lst.push(r);
    porEixo.set(r.eixo_id, lst);
  }
  const out: TrechoUmidade[] = [];
  for (const [eixo, lst] of [...porEixo.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    lst.sort((a, b) => a.sta_a - b.sta_a);
    let atual: TrechoUmidade | null = null;
    let somaWv = 0;
    let fimAnterior = -Infinity;
    for (const r of lst) {
      const na = r.amostras.filter((a) => a.w >= wMin);
      const v = na.reduce((s, a) => s + a.v_m3, 0);
      const ve = na.reduce((s, a) => s + a.v_extrap_m3, 0);
      const largura = r.sta_b - r.sta_a;
      if (v + ve <= epsM3) {
        // lacuna: fecha o trecho se passar da tolerância
        if (atual && r.sta_a - fimAnterior > tolBins * largura + 0.01) {
          atual.w_medio = somaWv / (atual.v_m3 + atual.v_extrap_m3);
          out.push(atual);
          atual = null;
        }
        continue;
      }
      if (atual && r.sta_a - fimAnterior > tolBins * largura + 0.01) {
        atual.w_medio = somaWv / (atual.v_m3 + atual.v_extrap_m3);
        out.push(atual);
        atual = null;
      }
      if (!atual) {
        atual = {
          eixo_id: eixo, sta_a: r.sta_a, sta_b: r.sta_b,
          v_m3: 0, v_extrap_m3: 0, w_min: Infinity, w_max: -Infinity,
          w_medio: 0, furos: [],
        };
        somaWv = 0;
      }
      atual.sta_b = r.sta_b;
      atual.v_m3 += v;
      atual.v_extrap_m3 += ve;
      for (const a of na) {
        atual.w_min = Math.min(atual.w_min, a.w);
        atual.w_max = Math.max(atual.w_max, a.w);
        somaWv += a.w * (a.v_m3 + a.v_extrap_m3);
        if (!atual.furos.includes(a.furo_id)) atual.furos.push(a.furo_id);
      }
      fimAnterior = r.sta_b;
    }
    if (atual) {
      atual.w_medio = somaWv / (atual.v_m3 + atual.v_extrap_m3);
      out.push(atual);
    }
  }
  return out;
}

/* ═══════════════════════ 2. LITOLOGIA ══════════════════════ */

export interface LitoVol {
  litologia: string;
  categoria: number; // 0 = sem categoria
  v_m3: number;
}

export interface LitologiaBinRow {
  eixo_id: string;
  sta_a: number;
  sta_b: number;
  v_corte: number;
  porLito: LitoVol[];
  /** m³ de solo (1ª cat) acima do primeiro estrato */
  v_solo_m3: number;
  /** m³ sem classificação (fora dos painéis / sem corte no perfil) */
  v_sem_class: number;
}

export interface LitologiaEixo {
  eixo_id: string;
  v_corte_total: number;
  /** m³ classificados (estratos + solo) */
  v_coberto: number;
  totais: LitoVol[];
  v_solo_m3: number;
  v_sem_class: number;
  rows: LitologiaBinRow[];
}

/** Interpola z numa polyline de pares [sta, z] ordenados. */
function interpPares(pts: [number, number][], x: number): number | null {
  if (!pts.length) return null;
  if (x < pts[0][0] || x > pts[pts.length - 1][0]) return null;
  for (let i = 1; i < pts.length; i++) {
    const [x1, z1] = pts[i - 1];
    const [x2, z2] = pts[i];
    if (x >= x1 && x <= x2) {
      if (x2 === x1) return z1;
      return z1 + ((x - x1) * (z2 - z1)) / (x2 - x1);
    }
  }
  return null;
}

/** Cruzamentos z da vertical x=s com um anel de polígono (pares dentro/fora). */
function zCrossings(poly: [number, number][], x: number): number[] {
  const zs: number[] = [];
  for (let i = 0; i < poly.length; i++) {
    const [x1, z1] = poly[i];
    const [x2, z2] = poly[(i + 1) % poly.length];
    if ((x1 <= x && x2 > x) || (x2 <= x && x1 > x)) {
      zs.push(z1 + ((x - x1) * (z2 - z1)) / (x2 - x1));
    }
  }
  zs.sort((a, b) => a - b);
  return zs;
}

function litoLabel(e: MtpEstratoGeo): string {
  return (e.litologia || e.material || e.formacao || "?").toLowerCase();
}

/**
 * Categoria de escavação do estrato. A alteração tem precedência sobre a
 * categoria gravada: pacotes antigos classificaram SR (= Solo Residual, logo
 * sob o terreno) como 3ª por engano — SR é 1ª; RAM 2ª; RAD/RS 3ª.
 */
export function catDoEstrato(e: MtpEstratoGeo): number {
  const a = (e.alteracao ?? "").toUpperCase();
  if (a === "SR") return 1;
  if (a === "RAM") return 2;
  if (a === "RAD" || a === "RS") return 3;
  return e.categoria ?? 0;
}

/** União de intervalos [lo, hi] → espessura total sem sobreposição. */
function espessuraUniao(intervalos: [number, number][]): number {
  if (!intervalos.length) return 0;
  intervalos.sort((a, b) => a[0] - b[0]);
  let total = 0;
  let [lo, hi] = intervalos[0];
  for (let i = 1; i < intervalos.length; i++) {
    const [l, h] = intervalos[i];
    if (l > hi) {
      total += hi - lo;
      lo = l;
      hi = h;
    } else if (h > hi) hi = h;
  }
  return total + (hi - lo);
}

/**
 * Cruza os estratos do perfil geológico com o corte por bin de um eixo →
 * m³ por (litologia, categoria). Solo acima do primeiro estrato = 1ª cat.
 */
export function litologiaCortePorEixo(
  perfilEixo: MtpPerfilEixo,
  bins: MtpBin[],
  { nAmostras = 5 }: { nAmostras?: number } = {},
): LitologiaEixo | null {
  const estratos = (perfilEixo.estratos ?? []).filter((e) => e.poligonos?.length);
  if (!estratos.length || !perfilEixo.terreno?.length || !perfilEixo.greide?.length)
    return null;
  const binsEixo = bins.filter((b) => b.eixo_id === perfilEixo.eixo_id && b.v_corte > 0);
  if (!binsEixo.length) return null;

  const rows: LitologiaBinRow[] = [];
  const totais = new Map<string, LitoVol>();
  let vTotal = 0, vCoberto = 0, vSolo = 0, vSem = 0;

  for (const bin of binsEixo) {
    vTotal += bin.v_corte;
    const row: LitologiaBinRow = {
      eixo_id: bin.eixo_id, sta_a: bin.sta_a, sta_b: bin.sta_b,
      v_corte: bin.v_corte, porLito: [], v_solo_m3: 0, v_sem_class: 0,
    };
    // amostra nAmostras estações no bin (pontos médios de sub-intervalos)
    const th = new Map<string, { litologia: string; categoria: number; t: number }>();
    let somaProf = 0;
    let somaSolo = 0;
    for (let k = 0; k < nAmostras; k++) {
      const s = bin.sta_a + ((k + 0.5) * (bin.sta_b - bin.sta_a)) / nAmostras;
      const zt = interpPares(perfilEixo.terreno, s);
      const zg = interpPares(perfilEixo.greide, s);
      if (zt == null || zg == null) continue;
      const d = Math.max(0, zt - zg);
      if (d <= 0) continue;
      somaProf += d;
      // intervalos de corte dentro de cada (litologia, categoria); a união
      // por chave elimina polígonos duplicados/sobrepostos do mesmo material
      const porKey = new Map<string, { litologia: string; categoria: number; ivs: [number, number][] }>();
      for (const e of estratos) {
        const lito = litoLabel(e);
        const cat = catDoEstrato(e);
        const key = `${lito}|${cat}`;
        for (const poly of e.poligonos) {
          const zs = zCrossings(poly, s);
          for (let i = 0; i + 1 < zs.length; i += 2) {
            const lo = Math.max(zs[i], zg);
            const hi = Math.min(zs[i + 1], zt);
            if (hi - lo > 0) {
              const cur = porKey.get(key) ?? { litologia: lito, categoria: cat, ivs: [] };
              cur.ivs.push([lo, hi]);
              porKey.set(key, cur);
            }
          }
        }
      }
      let tEstratos = 0;
      const locais: { key: string; litologia: string; categoria: number; t: number }[] = [];
      for (const [key, g] of porKey) {
        const t = espessuraUniao(g.ivs);
        if (t > 0) {
          locais.push({ key, litologia: g.litologia, categoria: g.categoria, t });
          tEstratos += t;
        }
      }
      // chaves distintas sobrepostas não podem exceder a coluna de corte
      const fator = tEstratos > d ? d / tEstratos : 1;
      for (const l of locais) {
        const cur = th.get(l.key) ?? { litologia: l.litologia, categoria: l.categoria, t: 0 };
        cur.t += l.t * fator;
        th.set(l.key, cur);
      }
      somaSolo += Math.max(0, d - tEstratos * fator);
    }
    if (somaProf <= 0) {
      row.v_sem_class = bin.v_corte;
      vSem += bin.v_corte;
      rows.push(row);
      continue;
    }
    for (const { litologia, categoria, t } of th.values()) {
      const v = (bin.v_corte * t) / somaProf;
      row.porLito.push({ litologia, categoria, v_m3: v });
      const key = `${litologia}|${categoria}`;
      const cur = totais.get(key) ?? { litologia, categoria, v_m3: 0 };
      cur.v_m3 += v;
      totais.set(key, cur);
      vCoberto += v;
    }
    row.v_solo_m3 = (bin.v_corte * somaSolo) / somaProf;
    vSolo += row.v_solo_m3;
    vCoberto += row.v_solo_m3;
    row.porLito.sort((a, b) => b.categoria - a.categoria || b.v_m3 - a.v_m3);
    rows.push(row);
  }

  return {
    eixo_id: perfilEixo.eixo_id,
    v_corte_total: vTotal,
    v_coberto: vCoberto,
    totais: [...totais.values()].sort((a, b) => b.categoria - a.categoria || b.v_m3 - a.v_m3),
    v_solo_m3: vSolo,
    v_sem_class: vSem,
    rows,
  };
}

/** Trecho contíguo com volume de uma categoria, detalhado por litologia. */
export interface TrechoLitologia {
  eixo_id: string;
  sta_a: number;
  sta_b: number;
  categoria: number;
  v_total_m3: number;
  porLito: LitoVol[];
}

/**
 * Agrupa bins contíguos (tolerância de 1 bin) com volume na categoria.
 */
export function trechosLitologia(
  rows: LitologiaBinRow[],
  categoria: number,
  { epsM3 = 1, tolBins = 1 }: { epsM3?: number; tolBins?: number } = {},
): TrechoLitologia[] {
  const out: TrechoLitologia[] = [];
  const lst = [...rows].sort((a, b) => a.sta_a - b.sta_a);
  let atual: TrechoLitologia | null = null;
  let mapa = new Map<string, LitoVol>();
  let fimAnterior = -Infinity;

  const fecha = () => {
    if (!atual) return;
    atual.porLito = [...mapa.values()].sort((a, b) => b.v_m3 - a.v_m3);
    out.push(atual);
    atual = null;
    mapa = new Map();
  };

  for (const r of lst) {
    const na = r.porLito.filter((l) => l.categoria === categoria);
    const v = na.reduce((s, l) => s + l.v_m3, 0);
    const largura = r.sta_b - r.sta_a;
    if (v <= epsM3) {
      if (atual && r.sta_a - fimAnterior > tolBins * largura + 0.01) fecha();
      continue;
    }
    if (atual && r.sta_a - fimAnterior > tolBins * largura + 0.01) fecha();
    if (!atual) {
      atual = {
        eixo_id: r.eixo_id, sta_a: r.sta_a, sta_b: r.sta_b,
        categoria, v_total_m3: 0, porLito: [],
      };
    }
    atual.sta_b = r.sta_b;
    atual.v_total_m3 += v;
    for (const l of na) {
      const cur = mapa.get(l.litologia) ?? { litologia: l.litologia, categoria, v_m3: 0 };
      cur.v_m3 += l.v_m3;
      mapa.set(l.litologia, cur);
    }
    fimAnterior = r.sta_b;
  }
  fecha();
  return out;
}
