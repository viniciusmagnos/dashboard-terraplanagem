// =====================================================
// Motor de cenários de terraplenagem — modelo econômico
// portado do dashboard Motiva (CenarioContext.tsx) e
// adaptado ao "híbrido" do hub:
//
//   camada física  = Brückner real dos bins do pacote
//                    (analyzeBruckner: momento, DMT e
//                    residuais → jazida/bota-fora vivos)
//   camada econômica = premissas editáveis por cima
//                    (alargamentos reclassificam origem/
//                    destino; DMTs de ACESSO além do eixo;
//                    custos unitários SICRO)
//
// Funções puras — testadas em cenario.test.ts com os
// goldens da Motiva (CB/C1) e com o pacote EPR real.
// =====================================================

import {
  analyzeBruckner,
  type BrucknerResult,
} from "./bruckner";
import type { MtpPacote } from "./mtp";

/* ── Custos unitários ─────────────────────────────────────── */

export interface CustosUnitarios {
  escavacao12: number; // R$/m³ — escavação 1ª/2ª categoria
  escavacao3: number; // R$/m³ — rocha
  escavacaoCFT: number; // R$/m³
  escavacaoSoloMole: number; // R$/m³
  escavacaoJazida: number; // R$/m³
  transporte: number; // R$/m³·km
  compactacaoAterro: number; // R$/m³c
  compactacaoCFT: number; // R$/m³c
  compactacaoSoloMole: number; // R$/m³c
  royalty: number; // R$/m³ — só fora da faixa de domínio
  conformacaoBF: number; // R$/m³
}

export const CUSTOS_REFERENCIA = "SICRO OUT/2024";

export const CUSTOS_SICRO_OUT2024: CustosUnitarios = {
  escavacao12: 9.0,
  escavacao3: 28.5,
  escavacaoCFT: 11.0,
  escavacaoSoloMole: 8.5,
  escavacaoJazida: 9.0,
  transporte: 2.7,
  compactacaoAterro: 19.0,
  compactacaoCFT: 19.0,
  compactacaoSoloMole: 15.0,
  royalty: 15.0,
  conformacaoBF: 4.0,
};

/** Custos do pacote (quando presentes) sobre os defaults SICRO. */
export function custosDoPacote(p: MtpPacote): CustosUnitarios {
  const out = { ...CUSTOS_SICRO_OUT2024 };
  const src = p.custos ?? {};
  for (const k of Object.keys(out) as (keyof CustosUnitarios)[]) {
    const v = src[k];
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

/* ── Premissas do cenário ─────────────────────────────────── */

/**
 * Mesmas chaves de `premissas_default` do pacote (modelo Motiva).
 * Percentuais em fração 0–1; DMTs em km.
 *
 * Semântica no híbrido: o momento corte→aterro vem do Brückner
 * (percurso DENTRO do eixo); os DMTs de jazida/BF significam a
 * distância de ACESSO além do eixo. `dmtCorteAterro` é usado só
 * como fallback quando o pacote não tem Brückner.
 */
export interface PremissasCenario {
  cftPercent: number;
  alargamentoCortePercent: number;
  alargamentoAterroPercent: number;
  dmtCorteAterro: number;
  dmtJazidaNaFaixa: number;
  dmtJazidaForaFaixa: number;
  dmtBFNaFaixa: number;
  dmtBFForaFaixa: number;
  dmtCFT: number;
  dmtSoloMole: number;
}

export const PREMISSAS_PADRAO: PremissasCenario = {
  cftPercent: 1.0,
  alargamentoCortePercent: 0,
  alargamentoAterroPercent: 0,
  dmtCorteAterro: 2.0,
  dmtJazidaNaFaixa: 0,
  dmtJazidaForaFaixa: 10.0,
  dmtBFNaFaixa: 0,
  dmtBFForaFaixa: 10.0,
  dmtCFT: 0.5,
  dmtSoloMole: 10.0,
};

/** Lê `premissas_default` do pacote com fallback nos padrões Motiva. */
export function premissasDoPacote(p: MtpPacote): PremissasCenario {
  const out = { ...PREMISSAS_PADRAO };
  const src = p.premissas_default ?? {};
  for (const k of Object.keys(out) as (keyof PremissasCenario)[]) {
    const v = src[k];
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

/* ── Definição de cenário e entradas de projeto ───────────── */

export interface BarreiraExtra {
  sta_m: number;
  nome: string;
}

export interface BrucknerParams {
  fillFactor: number;
  baseline: "start" | "median";
  /** Estações (m) das barreiras DO PACOTE que estão ativas. */
  barreirasAtivas: number[];
  /** Barreiras adicionadas manualmente no cenário. */
  barreirasExtras: BarreiraExtra[];
}

/** Entradas de nível PROJETO (compartilhadas por todos os cenários). */
export interface EntradasProjeto {
  cftBase: number | null; // m³ — CFT base 100% (não extraído do LandXML)
  soloMole: number | null; // m³
  soloMoleCompactado: number | null; // m³c (default: soloMole × 1,25)
  pct3Cat: number; // fração do corte em 3ª cat (rocha)
  pct2Cat: number; // fração do corte em 2ª cat
  custos: CustosUnitarios;
  custosEditados: boolean; // provenance: default → manual
}

export interface CenarioDef {
  id: string;
  nome: string;
  descricao?: string;
  criadoEm: string;
  bruckner: BrucknerParams;
  premissas: PremissasCenario;
}

/**
 * Shape persistido do estudo — o MESMO objeto vai para o localStorage
 * (`manta:landxml:estudo:{projetoId}`) e para o store server-side
 * (`PUT /api/landxml/estudos/{id}/estado`). Espelho Python:
 * `manta_shared.cenario.EstudoPersistido`.
 */
export interface EstudoPersistido {
  v: 2;
  entradas: EntradasProjeto;
  cenarios: CenarioDef[];
  cenarioAtivoId: string | null;
}

/* ── Volumes resolvidos (sem null) ────────────────────────── */

export interface VolumesResolvidos {
  corteTotal: number;
  aterroFc: number;
  corte1Cat: number;
  corte2Cat: number;
  corte12Cat: number;
  corte3Cat: number;
  cftBase: number;
  soloMole: number;
  soloMoleCompactado: number;
  jazidaTotal: number;
  bf1Cat: number;
  bf3Cat: number;
  bfTotal: number;
}

/**
 * Resolve os campos null do pacote: categorias por premissa (%),
 * jazida/BF pelos residuais do Brückner VIVO do cenário (quando
 * disponível), CFT/solo mole por entrada manual.
 */
export function resolverVolumes(
  pacote: MtpPacote,
  entradas: EntradasProjeto,
  brTotals: BrucknerResult["totals"] | null,
): VolumesResolvidos {
  const vb = pacote.volumes_base;
  const corteTotal = vb.corteTotal;
  const aterroFc = vb.aterroFc;

  const corte3Cat = vb.corte3Cat ?? Math.round(corteTotal * entradas.pct3Cat);
  const corte2Cat = vb.corte2Cat ?? Math.round(corteTotal * entradas.pct2Cat);
  const corte1Cat = vb.corte1Cat ?? corteTotal - corte2Cat - corte3Cat;
  const corte12Cat = vb.corte12Cat ?? corte1Cat + corte2Cat;

  const vivo = brTotals != null;
  const jazidaTotal = vivo
    ? brTotals.falta_emprestimo
    : (vb.jazidaTotal ?? 0);
  const bfTotal = vivo ? brTotals.sobra_bota_fora : (vb.bfTotal ?? 0);
  // No modo vivo o bfTotal muda com as barreiras/baseline — o split por
  // categoria é sempre re-derivado da premissa; no modo pacote respeita
  // valores explícitos quando existirem.
  const bf3Cat = vivo
    ? Math.round(bfTotal * entradas.pct3Cat)
    : (vb.bf3Cat ?? Math.round(bfTotal * entradas.pct3Cat));
  const bf1Cat = vivo ? bfTotal - bf3Cat : (vb.bf1Cat ?? bfTotal - bf3Cat);

  const cftBase = entradas.cftBase ?? vb.cftBase ?? 0;
  const soloMole = entradas.soloMole ?? vb.soloMole ?? 0;
  const soloMoleCompactado =
    entradas.soloMoleCompactado ??
    vb.soloMoleCompactado ??
    Math.round(soloMole * 1.25);

  return {
    corteTotal,
    aterroFc,
    corte1Cat,
    corte2Cat,
    corte12Cat,
    corte3Cat,
    cftBase,
    soloMole,
    soloMoleCompactado,
    jazidaTotal,
    bf1Cat,
    bf3Cat,
    bfTotal,
  };
}

/* ── Camada econômica (port Motiva) ───────────────────────── */

export interface VolumesCalculados {
  cftVolume: number;
  jazidaNaFaixa: number;
  jazidaForaFaixa: number;
  jazidaTotal: number;
  bfNaFaixa: number;
  bfForaFaixa: number;
  bf3Cat: number;
  bfTotal: number;
  alargamentoCorteDisponivel: number;
  alargamentoAterroDisponivel: number;
}

/**
 * Alargamentos RECLASSIFICAM origem/destino (não criam volume):
 * jazida/BF "na faixa" ficam sem royalty e com DMT curto. O cap
 * `min(disponível, necessário)` é um desvio deliberado da Motiva
 * (lá o alargamento podia exceder a jazida total).
 */
export function calcularVolumesCenario(
  vb: VolumesResolvidos,
  pr: PremissasCenario,
): VolumesCalculados {
  const cftVolume = Math.round(vb.cftBase * pr.cftPercent);

  const alargamentoCorteDisponivel = Math.round(
    vb.corteTotal * pr.alargamentoCortePercent,
  );
  const alargamentoAterroDisponivel = Math.round(
    vb.aterroFc * pr.alargamentoAterroPercent,
  );

  const jazidaNaFaixa = Math.min(alargamentoCorteDisponivel, vb.jazidaTotal);
  const jazidaForaFaixa = Math.max(0, vb.jazidaTotal - jazidaNaFaixa);

  const bfNaFaixa = Math.min(alargamentoAterroDisponivel, vb.bf1Cat);
  const bfForaFaixa = Math.max(0, vb.bf1Cat - bfNaFaixa);

  return {
    cftVolume,
    jazidaNaFaixa,
    jazidaForaFaixa,
    jazidaTotal: jazidaNaFaixa + jazidaForaFaixa,
    bfNaFaixa,
    bfForaFaixa,
    bf3Cat: vb.bf3Cat, // rocha: sempre fora da faixa
    bfTotal: bfNaFaixa + bfForaFaixa + vb.bf3Cat,
    alargamentoCorteDisponivel,
    alargamentoAterroDisponivel,
  };
}

export interface MomentoCenario {
  corteAterro: number; // m³·km
  corteAterroFonte: "bruckner" | "premissa";
  jazidaNaFaixa: number;
  jazidaForaFaixa: number;
  bfNaFaixa: number;
  bfForaFaixa: number;
  bf3Cat: number;
  cft: number;
  soloMole: number;
  total: number;
}

export function calcularMomentoCenario(
  vb: VolumesResolvidos,
  vc: VolumesCalculados,
  pr: PremissasCenario,
  momentoBrucknerM3km: number | null,
): MomentoCenario {
  const corteAterro =
    momentoBrucknerM3km ?? vb.aterroFc * pr.dmtCorteAterro;
  const jazidaNaFaixa = vc.jazidaNaFaixa * pr.dmtJazidaNaFaixa;
  const jazidaForaFaixa = vc.jazidaForaFaixa * pr.dmtJazidaForaFaixa;
  const bfNaFaixa = vc.bfNaFaixa * pr.dmtBFNaFaixa;
  const bfForaFaixa = vc.bfForaFaixa * pr.dmtBFForaFaixa;
  const bf3Cat = vc.bf3Cat * pr.dmtBFForaFaixa;
  const cft = vc.cftVolume * pr.dmtCFT;
  const soloMole = vb.soloMole * pr.dmtSoloMole;
  return {
    corteAterro,
    corteAterroFonte: momentoBrucknerM3km != null ? "bruckner" : "premissa",
    jazidaNaFaixa,
    jazidaForaFaixa,
    bfNaFaixa,
    bfForaFaixa,
    bf3Cat,
    cft,
    soloMole,
    total:
      corteAterro +
      jazidaNaFaixa +
      jazidaForaFaixa +
      bfNaFaixa +
      bfForaFaixa +
      bf3Cat +
      cft +
      soloMole,
  };
}

export interface OrcamentoDetalhado {
  escavacao: {
    corte12: number;
    corte3: number;
    cft: number;
    jazidaNaFaixa: number;
    jazidaForaFaixa: number;
    soloMole: number;
    subtotal: number;
  };
  transporte: { momento: number; custo: number };
  compactacao: {
    aterro: number;
    cft: number;
    soloMole: number;
    subtotal: number;
  };
  royalty: {
    jazidaForaFaixa: number;
    bfForaFaixa: number;
    bf3Cat: number;
    subtotal: number;
  };
  conformacaoBF: {
    naFaixa: number;
    foraFaixa: number;
    bf3Cat: number;
    subtotal: number;
  };
  total: number;
}

export function calcularOrcamentoCenario(
  vb: VolumesResolvidos,
  vc: VolumesCalculados,
  momento: MomentoCenario,
  custos: CustosUnitarios,
): OrcamentoDetalhado {
  const escavacaoCorte12 = vb.corte12Cat * custos.escavacao12;
  const escavacaoCorte3 = vb.corte3Cat * custos.escavacao3;
  const escavacaoCFT = vc.cftVolume * custos.escavacaoCFT;
  const escavacaoJazidaNaFaixa = vc.jazidaNaFaixa * custos.escavacaoJazida;
  const escavacaoJazidaForaFaixa = vc.jazidaForaFaixa * custos.escavacaoJazida;
  const escavacaoSoloMole = vb.soloMole * custos.escavacaoSoloMole;
  const subtotalEscavacao =
    escavacaoCorte12 +
    escavacaoCorte3 +
    escavacaoCFT +
    escavacaoJazidaNaFaixa +
    escavacaoJazidaForaFaixa +
    escavacaoSoloMole;

  const custoTransporte = momento.total * custos.transporte;

  const compactacaoAterro = vb.aterroFc * custos.compactacaoAterro;
  const compactacaoCFT = vc.cftVolume * custos.compactacaoCFT;
  const compactacaoSoloMole = vb.soloMoleCompactado * custos.compactacaoSoloMole;
  const subtotalCompactacao =
    compactacaoAterro + compactacaoCFT + compactacaoSoloMole;

  // Royalty: SÓ fora da faixa de domínio — é aqui que o alargamento economiza.
  const royaltyJazidaForaFaixa = vc.jazidaForaFaixa * custos.royalty;
  const royaltyBFForaFaixa = vc.bfForaFaixa * custos.royalty;
  const royaltyBF3Cat = vc.bf3Cat * custos.royalty;
  const subtotalRoyalty =
    royaltyJazidaForaFaixa + royaltyBFForaFaixa + royaltyBF3Cat;

  const conformacaoBFNaFaixa = vc.bfNaFaixa * custos.conformacaoBF;
  const conformacaoBFForaFaixa = vc.bfForaFaixa * custos.conformacaoBF;
  const conformacaoBF3Cat = vc.bf3Cat * custos.conformacaoBF;
  const subtotalConformacaoBF =
    conformacaoBFNaFaixa + conformacaoBFForaFaixa + conformacaoBF3Cat;

  const total =
    subtotalEscavacao +
    custoTransporte +
    subtotalCompactacao +
    subtotalRoyalty +
    subtotalConformacaoBF;

  return {
    escavacao: {
      corte12: escavacaoCorte12,
      corte3: escavacaoCorte3,
      cft: escavacaoCFT,
      jazidaNaFaixa: escavacaoJazidaNaFaixa,
      jazidaForaFaixa: escavacaoJazidaForaFaixa,
      soloMole: escavacaoSoloMole,
      subtotal: subtotalEscavacao,
    },
    transporte: { momento: momento.total, custo: custoTransporte },
    compactacao: {
      aterro: compactacaoAterro,
      cft: compactacaoCFT,
      soloMole: compactacaoSoloMole,
      subtotal: subtotalCompactacao,
    },
    royalty: {
      jazidaForaFaixa: royaltyJazidaForaFaixa,
      bfForaFaixa: royaltyBFForaFaixa,
      bf3Cat: royaltyBF3Cat,
      subtotal: subtotalRoyalty,
    },
    conformacaoBF: {
      naFaixa: conformacaoBFNaFaixa,
      foraFaixa: conformacaoBFForaFaixa,
      bf3Cat: conformacaoBF3Cat,
      subtotal: subtotalConformacaoBF,
    },
    total,
  };
}

export interface Economia {
  total: number;
  percent: number; // 0–100
  cft: {
    escavacao: number;
    compactacao: number;
    transporte: number;
    total: number;
  };
  royalty: { jazida: number; botaFora: number; total: number };
  transporte: number;
}

/** Economia do cenário vs caso base, com 3 vetores isolados (modelo Motiva). */
export function calcularEconomia(
  orcamentoCB: OrcamentoDetalhado,
  orcamentoAlt: OrcamentoDetalhado,
  vbCB: VolumesResolvidos,
  vcAlt: VolumesCalculados,
  custos: CustosUnitarios,
  premissasAlt: PremissasCenario,
): Economia {
  const total = orcamentoCB.total - orcamentoAlt.total;
  const percent =
    Math.abs(orcamentoCB.total) > 1e-9 ? (total / orcamentoCB.total) * 100 : 0;

  const volumeCFTReduzido = vbCB.cftBase - vcAlt.cftVolume;
  const economiaCFTEscav = volumeCFTReduzido * custos.escavacaoCFT;
  const economiaCFTComp = volumeCFTReduzido * custos.compactacaoCFT;
  const economiaCFTTransp =
    volumeCFTReduzido * premissasAlt.dmtCFT * custos.transporte;

  const economiaRoyaltyJazida = vcAlt.jazidaNaFaixa * custos.royalty;
  const economiaRoyaltyBF = vcAlt.bfNaFaixa * custos.royalty;

  return {
    total,
    percent,
    cft: {
      escavacao: economiaCFTEscav,
      compactacao: economiaCFTComp,
      transporte: economiaCFTTransp,
      total: economiaCFTEscav + economiaCFTComp + economiaCFTTransp,
    },
    royalty: {
      jazida: economiaRoyaltyJazida,
      botaFora: economiaRoyaltyBF,
      total: economiaRoyaltyJazida + economiaRoyaltyBF,
    },
    transporte: orcamentoCB.transporte.custo - orcamentoAlt.transporte.custo,
  };
}

/* ── DME — Distância Máxima Econômica (didática) ──────────── */

export interface DmeInfo {
  dmeKm: number;
  formula: string;
  calculo: string;
  resultado: string;
  interpretacao: string;
}

export function calcularDME(c: CustosUnitarios): {
  jazida: DmeInfo;
  alargamento: DmeInfo;
  botaFora: DmeInfo;
} {
  const t = c.transporte;
  const fmt2 = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  const dmeJazida = t > 0 ? (c.escavacaoJazida + c.royalty) / t : Infinity;
  const dmeAlarg = t > 0 ? c.royalty / t : Infinity;
  return {
    jazida: {
      dmeKm: dmeJazida,
      formula: "DME = (escavação jazida + royalty) ÷ transporte",
      calculo: `(R$ ${fmt2(c.escavacaoJazida)} + R$ ${fmt2(c.royalty)}) ÷ R$ ${fmt2(t)}/m³·km`,
      resultado: `${fmt2(dmeJazida)} km`,
      interpretacao:
        "Até esta distância, transportar material de corte compensa mais do que abrir jazida externa (escavação + royalty).",
    },
    alargamento: {
      dmeKm: dmeAlarg,
      formula: "DME = royalty ÷ transporte",
      calculo: `R$ ${fmt2(c.royalty)} ÷ R$ ${fmt2(t)}/m³·km`,
      resultado: `${fmt2(dmeAlarg)} km`,
      interpretacao:
        "Se a jazida externa está a mais que isto do alargamento de corte, o alargamento (sem royalty) vence mesmo com escavação equivalente.",
    },
    botaFora: {
      dmeKm: dmeAlarg,
      formula: "DME = royalty ÷ transporte",
      calculo: `R$ ${fmt2(c.royalty)} ÷ R$ ${fmt2(t)}/m³·km`,
      resultado: `${fmt2(dmeAlarg)} km`,
      interpretacao:
        "Distância extra máxima até um bota-fora externo antes que depositar na faixa (alargamento de aterro, sem royalty) seja mais barato.",
    },
  };
}

/* ── Orquestração de um cenário ───────────────────────────── */

export interface CenarioComputado {
  def: CenarioDef;
  bruckner: BrucknerResult | null;
  volumes: VolumesResolvidos;
  volumesCalc: VolumesCalculados;
  momento: MomentoCenario;
  orcamento: OrcamentoDetalhado;
}

export interface BinSimples {
  sta_a: number;
  sta_b: number;
  v_corte: number;
  v_aterro: number;
}

export function brucknerCacheKey(p: BrucknerParams): string {
  const barreiras = [
    ...p.barreirasAtivas,
    ...p.barreirasExtras.map((b) => b.sta_m),
  ]
    .sort((a, b) => a - b)
    .join(",");
  return `${p.fillFactor}|${p.baseline}|${barreiras}`;
}

export function computarCenario(args: {
  pacote: MtpPacote;
  binsMainline: BinSimples[];
  entradas: EntradasProjeto;
  def: CenarioDef;
  /** Caso base: injeta o Brückner embutido no pacote (sem recomputar). */
  brucknerPronto?: BrucknerResult | null;
  cache?: Map<string, BrucknerResult>;
}): CenarioComputado {
  const { pacote, binsMainline, entradas, def, brucknerPronto, cache } = args;

  let bruckner: BrucknerResult | null = null;
  if (brucknerPronto !== undefined) {
    bruckner = brucknerPronto;
  } else if (binsMainline.length) {
    const key = brucknerCacheKey(def.bruckner);
    const hit = cache?.get(key);
    if (hit) {
      bruckner = hit;
    } else {
      const barriers = [
        ...def.bruckner.barreirasAtivas,
        ...def.bruckner.barreirasExtras.map((b) => b.sta_m),
      ].sort((a, b) => a - b);
      bruckner = analyzeBruckner(binsMainline, {
        fillFactor: def.bruckner.fillFactor,
        baseline: def.bruckner.baseline,
        barriers,
        gapSplitM: pacote.bins_meta.gap_split_m,
      });
      cache?.set(key, bruckner);
    }
  }

  const brTotals = bruckner?.totals ?? null;
  const volumes = resolverVolumes(pacote, entradas, brTotals);
  const volumesCalc = calcularVolumesCenario(volumes, def.premissas);
  const momento = calcularMomentoCenario(
    volumes,
    volumesCalc,
    def.premissas,
    brTotals?.momento_m3km ?? null,
  );
  const orcamento = calcularOrcamentoCenario(
    volumes,
    volumesCalc,
    momento,
    entradas.custos,
  );
  return { def, bruckner, volumes, volumesCalc, momento, orcamento };
}
