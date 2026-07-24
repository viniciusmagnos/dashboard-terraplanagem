/**
 * Área por material no corte de uma seção transversal (Fase 2 da geotecnia).
 *
 * Cruza o corte da seção (região onde terreno > plataforma) com a pilha de
 * camadas do furo de sondagem do perfil (`perfil_geologico.sondagens`), por
 * PROFUNDIDADE abaixo do terreno local — mesmo modelo do
 * `dashboard_geotecnia.atribuir_materiais` (frações por profundidade), só que
 * por MATERIAL e por SEÇÃO. Resultado: m² de cada material no corte
 * (ex.: "12,3 m² de argila arenosa, N=8") + bandas para desenhar.
 *
 * Tudo em coordenadas da seção (offset, z − z_offset_m), como as linhas
 * `terreno`/`plataforma` do bloco geometria — o componente aplica X/Y.
 */
import { interpLinha, secaoBounds } from "./mtp-geometry";
import type { MtpGeoEixo, MtpGeoSecao, MtpSondagemPerfil } from "./mtp";

export interface ItemMaterialCorte {
  material: string;
  categoria: number | null;
  /** menor/maior N dentre as camadas desse material (null se sem SPT) */
  n_min: number | null;
  n_max: number | null;
  /** área integrada no corte DESENHADO (terreno × plataforma) */
  area_m2: number;
  /** fração do corte desenhado (0–1) — rateável no corte oficial da seção */
  fracao: number;
  /** veio da extrapolação da última camada abaixo do fim do furo */
  extrapolado: boolean;
}

export interface BandaMaterialCorte {
  categoria: number | null;
  material: string;
  extrapolado: boolean;
  /** anéis (offset, z−z_offset) para preencher a faixa da camada no corte */
  rings: [number, number][][];
}

export interface AreaMateriaisCorte {
  itens: ItemMaterialCorte[];
  bandas: BandaMaterialCorte[];
  /** área de corte integrada (deve bater com secao.area_corte) */
  area_corte_m2: number;
  /** parte do corte coberta por camadas reais do furo (resto = extrapolado) */
  area_coberta_m2: number;
  furo_id: string;
  dist_m: number;
}

/** Furo do perfil mais próximo da estação (mesma lista já filtrada por eixo). */
export function furoPerfilMaisProximo(
  sondagens: MtpSondagemPerfil[] | undefined | null,
  sta: number,
  maxDist = 300,
): { furo: MtpSondagemPerfil; dist_m: number } | null {
  if (!sondagens?.length) return null;
  let best: { furo: MtpSondagemPerfil; dist_m: number } | null = null;
  for (const f of sondagens) {
    if (!f.camadas?.length) continue;
    const d = Math.abs(f.sta_m - sta);
    if (d <= maxDist && (best == null || d < best.dist_m)) {
      best = { furo: f, dist_m: d };
    }
  }
  return best;
}

interface Camada {
  de: number;
  a: number; // +Infinity na cauda extrapolada
  material: string;
  categoria: number | null;
  n_spt: number | null;
  extrapolado: boolean;
}

export function areaMateriaisCorte(
  secao: MtpGeoSecao,
  furo: MtpSondagemPerfil,
  dist_m: number,
  { passoMax = 0.25, maxAmostras = 600 }: { passoMax?: number; maxAmostras?: number } = {},
): AreaMateriaisCorte | null {
  const cams = [...furo.camadas].sort((x, y) => x.de_m - y.de_m);
  if (!cams.length) return null;

  const b = secaoBounds(secao);
  const span = b.offMax - b.offMin;
  if (!(span > 0.5)) return null;
  const n = Math.min(maxAmostras, Math.max(20, Math.ceil(span / passoMax)));
  const passo = span / n;

  // pilha de camadas + cauda extrapolada (última camada até o infinito), para
  // cobrir o corte além do fim do furo (furos param no impenetrável)
  const camadas: Camada[] = cams.map((c) => ({
    de: c.de_m,
    a: c.a_m,
    material: (c.material || "não descrito").trim(),
    categoria: c.categoria ?? null,
    n_spt: c.n_spt ?? null,
    extrapolado: false,
  }));
  const ult = camadas[camadas.length - 1];
  const cauda: Camada = {
    de: ult.a,
    a: Infinity,
    material: ult.material,
    categoria: ult.categoria,
    n_spt: ult.n_spt,
    extrapolado: true,
  };
  const layers = [...camadas, cauda];

  // acumuladores por camada (mantém identidade p/ agregar depois)
  const areaPorLayer = new Array(layers.length).fill(0) as number[];
  // runs de banda por camada (para desenhar)
  const topRun: [number, number][][] = layers.map(() => []);
  const botRun: [number, number][][] = layers.map(() => []);
  const rings: [number, number][][][] = layers.map(() => []);
  const fecharRun = (li: number) => {
    const t = topRun[li];
    const btm = botRun[li];
    if (t.length >= 2) rings[li].push([...t, ...btm.slice().reverse()]);
    topRun[li] = [];
    botRun[li] = [];
  };

  let areaCorte = 0;
  let areaCoberta = 0;

  for (let i = 0; i <= n; i++) {
    const x = b.offMin + i * passo;
    const T = interpLinha(secao.terreno, x);
    const P = interpLinha(secao.plataforma, x);
    const cut = T != null && P != null ? T - P : 0;
    const emCorte = cut > 1e-6;
    // largura representada por esta amostra (trapézio nas bordas)
    const wCell = i === 0 || i === n ? passo / 2 : passo;
    if (emCorte) areaCorte += cut * wCell;

    for (let li = 0; li < layers.length; li++) {
      const L = layers[li];
      let topZ: number | null = null;
      let botZ: number | null = null;
      if (emCorte && T != null && P != null) {
        // faixa da camada em profundidade [de, a] abaixo do terreno LOCAL,
        // recortada ao corte [P, T]
        const topDepth = L.de;
        const botDepth = Math.min(L.a, cut);
        if (botDepth > topDepth + 1e-9) {
          topZ = T - topDepth;
          botZ = T - botDepth;
          const h = topZ - botZ;
          areaPorLayer[li] += h * wCell;
          if (!L.extrapolado) areaCoberta += h * wCell;
        }
      }
      if (topZ != null && botZ != null) {
        topRun[li].push([x, topZ]);
        botRun[li].push([x, botZ]);
      } else if (topRun[li].length) {
        fecharRun(li);
      }
    }
  }
  layers.forEach((_, li) => fecharRun(li));

  if (areaCorte <= 0.1) return null; // seção sem corte — nada a repartir

  // agrega itens por (material + categoria + extrapolado)
  const chave = (L: Camada) => `${L.material}||${L.categoria ?? ""}||${L.extrapolado ? 1 : 0}`;
  const mapa = new Map<string, ItemMaterialCorte>();
  layers.forEach((L, li) => {
    const area = areaPorLayer[li];
    if (area <= 1e-6) return;
    const k = chave(L);
    const ex = mapa.get(k);
    if (ex) {
      ex.area_m2 += area;
      if (L.n_spt != null) {
        ex.n_min = ex.n_min == null ? L.n_spt : Math.min(ex.n_min, L.n_spt);
        ex.n_max = ex.n_max == null ? L.n_spt : Math.max(ex.n_max, L.n_spt);
      }
    } else {
      mapa.set(k, {
        material: L.material,
        categoria: L.categoria,
        n_min: L.n_spt,
        n_max: L.n_spt,
        area_m2: area,
        fracao: 0, // recalculado abaixo (área / corte desenhado)
        extrapolado: L.extrapolado,
      });
    }
  });
  const itens = [...mapa.values()]
    .map((it) => ({
      ...it,
      area_m2: Math.round(it.area_m2 * 100) / 100,
      fracao: areaCorte > 0 ? it.area_m2 / areaCorte : 0,
    }))
    .filter((it) => it.area_m2 > 0)
    .sort((a, c) => c.area_m2 - a.area_m2);

  const bandas: BandaMaterialCorte[] = layers
    .map((L, li) => ({
      categoria: L.categoria,
      material: L.material,
      extrapolado: L.extrapolado,
      rings: rings[li].filter((r) => r.length >= 3),
    }))
    .filter((band) => band.rings.length > 0);

  return {
    itens,
    bandas,
    area_corte_m2: Math.round(areaCorte * 100) / 100,
    area_coberta_m2: Math.round(areaCoberta * 100) / 100,
    furo_id: furo.id,
    dist_m,
  };
}

export interface CorteCategoriaEixo {
  eixo_id: string;
  corte_total: number;
  corte_1cat: number;
  corte_2cat: number;
  corte_3cat: number;
  /** volume de camadas sem categoria (material vazio + sem SPT) */
  sem_cat: number;
  n_secoes: number;
}

/**
 * Integra o método da seção (corte × furo do perfil mais próximo) ao longo de
 * um eixo → volume de corte (m³) por categoria. Cada seção contribui com
 * ``fração_cat × area_corte × comprimento`` (comprimento = metade p/ cada
 * vizinho). É a versão "total do eixo" do que a aba Seções mostra por seção.
 */
export function corteCategoriaPorEixoSecao(
  geoEixo: MtpGeoEixo,
  furos: MtpSondagemPerfil[] | undefined | null,
  maxDist = 300,
): CorteCategoriaEixo | null {
  const secs = [...(geoEixo.secoes ?? [])].sort((a, b) => a.sta_m - b.sta_m);
  if (secs.length === 0 || !furos?.length) return null;
  let c1 = 0, c2 = 0, c3 = 0, sc = 0, tot = 0, n = 0;
  for (let i = 0; i < secs.length; i++) {
    const sec = secs[i];
    if ((sec.area_corte ?? 0) <= 0.1) continue;
    let sp: number;
    if (secs.length === 1) sp = geoEixo.secoes_passo_m || 20;
    else if (i === 0) sp = secs[1].sta_m - secs[0].sta_m;
    else if (i === secs.length - 1) sp = secs[i].sta_m - secs[i - 1].sta_m;
    else sp = (secs[i + 1].sta_m - secs[i - 1].sta_m) / 2;
    if (!(sp > 0)) continue;
    const fm = furoPerfilMaisProximo(furos, sec.sta_m, maxDist);
    if (!fm) continue;
    const r = areaMateriaisCorte(sec, fm.furo, fm.dist_m);
    if (!r) continue;
    for (const it of r.itens) {
      const vol = it.fracao * sec.area_corte * sp;
      if (it.categoria === 1) c1 += vol;
      else if (it.categoria === 2) c2 += vol;
      else if (it.categoria === 3) c3 += vol;
      else sc += vol;
    }
    tot += sec.area_corte * sp;
    n += 1;
  }
  if (n === 0) return null;
  return {
    eixo_id: geoEixo.eixo_id,
    corte_total: tot,
    corte_1cat: c1,
    corte_2cat: c2,
    corte_3cat: c3,
    sem_cat: sc,
    n_secoes: n,
  };
}
