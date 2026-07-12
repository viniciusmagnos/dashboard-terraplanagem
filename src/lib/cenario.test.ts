/**
 * Goldens do motor de cenários.
 *
 * Bloco 1 — paridade com o modelo Motiva (CenarioContext.tsx do
 * dashboard-terraplenagem-motiva): Caso Base e Cenário 1 da Rota
 * Mogiana (ESTUDOR1), com os totais conferidos à mão.
 *
 * Bloco 2 — modo híbrido sobre o pacote EPR real: momento corte→aterro
 * e jazida/BF vêm do Brückner embutido; asserts compostos algebricamente
 * a partir do próprio fixture (exatos) + sanity absoluto.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { rebinBins } from "./bruckner";
import {
  CUSTOS_SICRO_OUT2024,
  calcularDME,
  calcularEconomia,
  calcularMomentoCenario,
  calcularOrcamentoCenario,
  calcularVolumesCenario,
  computarCenario,
  custosDoPacote,
  premissasDoPacote,
  resolverVolumes,
  type CenarioDef,
  type EntradasProjeto,
  type PremissasCenario,
  type VolumesResolvidos,
} from "./cenario";
import { validarPacote, type MtpPacote } from "./mtp";

const pacote: MtpPacote = validarPacote(
  readFileSync(
    new URL("./__fixtures__/epr-br365-581-607.mtp.json", import.meta.url),
    "utf-8",
  ),
);

function expectClose(a: number, b: number, rel = 1e-9, abs = 1e-6) {
  expect(Math.abs(a - b)).toBeLessThanOrEqual(abs + rel * Math.abs(b));
}

/* ── Fixtures Motiva (Rota Mogiana / ESTUDOR1) ────────────── */

const VOLUMES_MOGIANA: VolumesResolvidos = {
  corte1Cat: 5_882_385,
  corte2Cat: 865_008,
  corte12Cat: 6_747_393,
  corte3Cat: 451_138,
  corteTotal: 7_198_531,
  aterroFc: 5_555_735,
  cftBase: 3_363_300,
  soloMole: 153_400,
  soloMoleCompactado: 191_750,
  jazidaTotal: 1_813_989,
  bf1Cat: 1_612_465,
  bf3Cat: 360_911,
  bfTotal: 1_973_376,
};

const PREMISSAS_CB: PremissasCenario = {
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

const PREMISSAS_C1: PremissasCenario = {
  cftPercent: 0.5,
  alargamentoCortePercent: 0.15,
  alargamentoAterroPercent: 0.15,
  dmtCorteAterro: 1.2,
  dmtJazidaNaFaixa: 0.75,
  dmtJazidaForaFaixa: 7.0,
  dmtBFNaFaixa: 0.75,
  dmtBFForaFaixa: 7.0,
  dmtCFT: 0.5,
  dmtSoloMole: 7.0,
};

// Modo "Motiva puro": sem Brückner → dmtCorteAterro é usado.
function cenarioMotiva(pr: PremissasCenario) {
  const vc = calcularVolumesCenario(VOLUMES_MOGIANA, pr);
  const momento = calcularMomentoCenario(VOLUMES_MOGIANA, vc, pr, null);
  const orcamento = calcularOrcamentoCenario(
    VOLUMES_MOGIANA,
    vc,
    momento,
    CUSTOS_SICRO_OUT2024,
  );
  return { vc, momento, orcamento };
}

describe("paridade Motiva — Caso Base (Rota Mogiana)", () => {
  const { vc, momento, orcamento } = cenarioMotiva(PREMISSAS_CB);

  it("volumes: sem alargamento, tudo fora da faixa", () => {
    expect(vc.cftVolume).toBe(3_363_300);
    expect(vc.jazidaNaFaixa).toBe(0);
    expect(vc.jazidaForaFaixa).toBe(1_813_989);
    expect(vc.bfNaFaixa).toBe(0);
    expect(vc.bfForaFaixa).toBe(1_612_465);
    expect(vc.bfTotal).toBe(1_973_376);
  });

  it("momento total = 52.200.770 m³·km", () => {
    expect(momento.corteAterroFonte).toBe("premissa");
    expectClose(momento.total, 52_200_770);
  });

  it("orçamento por grupo e total = R$ 506.194.044", () => {
    expectClose(orcamento.escavacao.subtotal, 128_210_071);
    expectClose(orcamento.transporte.custo, 140_942_079);
    expectClose(orcamento.compactacao.subtotal, 172_337_915);
    expectClose(orcamento.royalty.subtotal, 56_810_475);
    expectClose(orcamento.conformacaoBF.subtotal, 7_893_504);
    expectClose(orcamento.total, 506_194_044);
  });
});

describe("paridade Motiva — Cenário 1 (alargamentos 15% + CFT 50%)", () => {
  const cb = cenarioMotiva(PREMISSAS_CB);
  const c1 = cenarioMotiva(PREMISSAS_C1);

  it("volumes reclassificados", () => {
    expect(c1.vc.cftVolume).toBe(1_681_650);
    expect(c1.vc.jazidaNaFaixa).toBe(1_079_780);
    expect(c1.vc.jazidaForaFaixa).toBe(734_209);
    expect(c1.vc.bfNaFaixa).toBe(833_360);
    expect(c1.vc.bfForaFaixa).toBe(779_105);
    expect(c1.vc.bf3Cat).toBe(360_911);
    // invariante: alargamento não cria jazida/BF, só reclassifica
    expect(c1.vc.jazidaTotal).toBe(1_813_989);
    expect(c1.vc.bfTotal).toBe(1_973_376);
  });

  it("momento total = 23.135.937 m³·km", () => {
    expectClose(c1.momento.total, 23_135_937);
  });

  it("orçamento por grupo e total = R$ 348.572.394,90", () => {
    expectClose(c1.orcamento.escavacao.subtotal, 109_711_921);
    expectClose(c1.orcamento.transporte.custo, 62_467_029.9);
    expectClose(c1.orcamento.compactacao.subtotal, 140_386_565);
    expectClose(c1.orcamento.royalty.subtotal, 28_113_375);
    expectClose(c1.orcamento.conformacaoBF.subtotal, 7_893_504);
    expectClose(c1.orcamento.total, 348_572_394.9);
  });

  it("economia = R$ 157.621.649,10 (31,1%) com vetores", () => {
    const eco = calcularEconomia(
      cb.orcamento,
      c1.orcamento,
      VOLUMES_MOGIANA,
      c1.vc,
      CUSTOS_SICRO_OUT2024,
      PREMISSAS_C1,
    );
    expectClose(eco.total, 157_621_649.1);
    expectClose(eco.percent, 31.138, 1e-3, 0.01);
    expectClose(eco.royalty.total, 28_697_100);
    expectClose(eco.cft.total, 52_719_727.5);
    expectClose(eco.transporte, 78_475_049.1);
  });
});

/* ── Modo híbrido — pacote EPR real ───────────────────────── */

function entradasEpr(): EntradasProjeto {
  return {
    cftBase: null,
    soloMole: null,
    soloMoleCompactado: null,
    pct3Cat: pacote.categorias.pct_3cat_default,
    pct2Cat: pacote.categorias.pct_2cat_default,
    custos: custosDoPacote(pacote),
    custosEditados: false,
  };
}

function defCasoBase(): CenarioDef {
  return {
    id: "caso-base",
    nome: "Caso base",
    criadoEm: "2026-07-06T00:00:00Z",
    bruckner: {
      fillFactor: pacote.bruckner!.params.fill_factor,
      baseline: pacote.bruckner!.params.baseline as "start" | "median",
      barreirasAtivas: pacote.bruckner!.params.barriers,
      barreirasExtras: [],
    },
    premissas: premissasDoPacote(pacote),
  };
}

describe("híbrido — caso base EPR (Brückner embutido + premissas default)", () => {
  const entradas = entradasEpr();
  const computed = computarCenario({
    pacote,
    binsMainline: [],
    entradas,
    def: defCasoBase(),
    brucknerPronto: pacote.bruckner,
  });
  const br = pacote.bruckner!.totals;
  const vb = pacote.volumes_base;
  const custos = entradas.custos;

  it("jazida/BF vêm dos residuais do Brückner", () => {
    expectClose(computed.volumes.jazidaTotal, br.falta_emprestimo);
    expectClose(computed.volumes.bfTotal, br.sobra_bota_fora);
  });

  it("momento total = momento Brückner + (jazida + BF) × 10 km", () => {
    expect(computed.momento.corteAterroFonte).toBe("bruckner");
    expectClose(computed.momento.corteAterro, br.momento_m3km);
    const esperado =
      br.momento_m3km + (br.falta_emprestimo + br.sobra_bota_fora) * 10;
    expectClose(computed.momento.total, esperado);
  });

  it("orçamento composto algebricamente do fixture", () => {
    const corte3 = Math.round(vb.corteTotal * pacote.categorias.pct_3cat_default);
    const escavacao =
      (vb.corteTotal - corte3) * custos.escavacao12 +
      corte3 * custos.escavacao3 +
      br.falta_emprestimo * custos.escavacaoJazida;
    expectClose(computed.orcamento.escavacao.subtotal, escavacao);
    expectClose(
      computed.orcamento.transporte.custo,
      computed.momento.total * custos.transporte,
    );
    expectClose(
      computed.orcamento.compactacao.subtotal,
      vb.aterroFc * custos.compactacaoAterro,
    );
    // bf3 sai do royalty de bfFora e entra em bf3 → soma fecha sem o split
    expectClose(
      computed.orcamento.royalty.subtotal,
      (br.falta_emprestimo + br.sobra_bota_fora) * custos.royalty,
    );
    expectClose(
      computed.orcamento.conformacaoBF.subtotal,
      br.sobra_bota_fora * custos.conformacaoBF,
    );
  });

  it("sanity absoluto: total ≈ R$ 54,7 M (fixture 2026-07-06)", () => {
    expect(computed.orcamento.total).toBeGreaterThan(50e6);
    expect(computed.orcamento.total).toBeLessThan(60e6);
    expectClose(computed.orcamento.total, 54_684_143, 2e-3, 0);
  });

  it("cenário com alargamento 15% reduz royalty e gera economia", () => {
    const def = defCasoBase();
    def.id = "c1";
    def.premissas = {
      ...def.premissas,
      alargamentoCortePercent: 0.15,
      alargamentoAterroPercent: 0.15,
      dmtJazidaNaFaixa: 0.75,
      dmtBFNaFaixa: 0.75,
      dmtJazidaForaFaixa: 7.0,
      dmtBFForaFaixa: 7.0,
    };
    const alt = computarCenario({
      pacote,
      binsMainline: [],
      entradas,
      def,
      brucknerPronto: pacote.bruckner,
    });
    expect(alt.volumesCalc.jazidaNaFaixa).toBeGreaterThan(0);
    expect(alt.orcamento.royalty.subtotal).toBeLessThan(
      computed.orcamento.royalty.subtotal,
    );
    const eco = calcularEconomia(
      computed.orcamento,
      alt.orcamento,
      computed.volumes,
      alt.volumesCalc,
      custos,
      def.premissas,
    );
    expect(eco.total).toBeGreaterThan(0);
    expect(eco.royalty.total).toBeGreaterThan(0);
  });
});

/* ── Escavação responde a corte/jazida (recompute VIVO) ───── */

function binsMainlineEpr() {
  const rodoviaIds = new Set(
    pacote.eixos.filter((e) => e.tipo === "rodovia").map((e) => e.id),
  );
  return rebinBins(
    pacote.bins.filter((b) => rodoviaIds.has(b.eixo_id)),
    pacote.bins_meta.largura_m,
  );
}

describe("escavação responde ao balanço físico (EPR vivo)", () => {
  const entradas = entradasEpr();
  const binsMainline = binsMainlineEpr();
  const viva = (mut?: (d: CenarioDef) => void) => {
    const def = defCasoBase();
    def.id = `t-${Math.random().toString(36).slice(2)}`;
    mut?.(def);
    return computarCenario({ pacote, binsMainline, entradas, def });
  };

  it("desligar as OAEs muda o empréstimo → escavação de jazida acompanha", () => {
    const com = viva(); // barreiras do pacote ativas
    const sem = viva((d) => {
      d.bruckner.barreirasAtivas = [];
    });
    expect(
      Math.abs(sem.volumes.jazidaTotal - com.volumes.jazidaTotal),
    ).toBeGreaterThan(1000);
    const dJazida = com.volumes.jazidaTotal - sem.volumes.jazidaTotal;
    expectClose(
      com.orcamento.escavacao.subtotal - sem.orcamento.escavacao.subtotal,
      dJazida * entradas.custos.escavacaoJazida,
      1e-9,
      1,
    );
  });

  it("fator de homogeneização maior → mais empréstimo → mais escavação", () => {
    const base = viva();
    const alto = viva((d) => {
      d.bruckner.fillFactor = 1.3;
    });
    expect(alto.volumes.jazidaTotal).toBeGreaterThan(base.volumes.jazidaTotal);
    expect(alto.orcamento.escavacao.subtotal).toBeGreaterThan(
      base.orcamento.escavacao.subtotal,
    );
    expect(alto.orcamento.transporte.custo).toBeGreaterThan(
      base.orcamento.transporte.custo,
    );
  });

  it("alargamento NÃO muda a escavação — reclassifica a origem (royalty/transporte caem)", () => {
    const base = viva();
    const alarg = viva((d) => {
      d.premissas = {
        ...d.premissas,
        alargamentoCortePercent: 0.15,
        alargamentoAterroPercent: 0.15,
        dmtJazidaNaFaixa: 0.75,
        dmtBFNaFaixa: 0.75,
      };
    });
    // volume escavado total (corte + jazida) idêntico — só muda DE ONDE vem
    expectClose(
      alarg.orcamento.escavacao.subtotal,
      base.orcamento.escavacao.subtotal,
      1e-12,
      1e-6,
    );
    expect(alarg.orcamento.royalty.subtotal).toBeLessThan(
      base.orcamento.royalty.subtotal,
    );
    expect(alarg.orcamento.transporte.custo).toBeLessThan(
      base.orcamento.transporte.custo,
    );
    expect(alarg.orcamento.total).toBeLessThan(base.orcamento.total);
  });
});

/* ── Bordas ───────────────────────────────────────────────── */

describe("bordas do motor", () => {
  it("cap: alargamento disponível maior que a jazida necessária", () => {
    const vb: VolumesResolvidos = {
      ...VOLUMES_MOGIANA,
      corteTotal: 1000,
      jazidaTotal: 100,
    };
    const vc = calcularVolumesCenario(vb, {
      ...PREMISSAS_CB,
      alargamentoCortePercent: 0.5, // disponível = 500 > necessário = 100
    });
    expect(vc.alargamentoCorteDisponivel).toBe(500);
    expect(vc.jazidaNaFaixa).toBe(100);
    expect(vc.jazidaForaFaixa).toBe(0);
    expect(vc.jazidaTotal).toBe(100); // invariante preservada
  });

  it("cftBase/soloMole nulos → linhas zeradas, sem NaN", () => {
    const entradas = entradasEpr();
    const computed = computarCenario({
      pacote,
      binsMainline: [],
      entradas,
      def: defCasoBase(),
      brucknerPronto: pacote.bruckner,
    });
    expect(computed.volumes.cftBase).toBe(0);
    expect(computed.volumesCalc.cftVolume).toBe(0);
    expect(computed.orcamento.escavacao.cft).toBe(0);
    expect(computed.orcamento.compactacao.soloMole).toBe(0);
    expect(Number.isFinite(computed.orcamento.total)).toBe(true);
  });

  it("sem Brückner → fallback dmtCorteAterro (modo Motiva)", () => {
    const entradas = entradasEpr();
    const computed = computarCenario({
      pacote,
      binsMainline: [],
      entradas,
      def: defCasoBase(),
      brucknerPronto: null,
    });
    expect(computed.momento.corteAterroFonte).toBe("premissa");
    expectClose(
      computed.momento.corteAterro,
      pacote.volumes_base.aterroFc * premissasDoPacote(pacote).dmtCorteAterro,
    );
  });

  it("resolverVolumes sem Brückner usa jazida/BF do pacote", () => {
    const vb = resolverVolumes(pacote, entradasEpr(), null);
    expectClose(vb.jazidaTotal, pacote.volumes_base.jazidaTotal ?? 0);
    expectClose(vb.bfTotal, pacote.volumes_base.bfTotal ?? 0);
  });

  it("custosDoPacote: pacote sem custos → defaults SICRO", () => {
    expect(custosDoPacote(pacote)).toEqual(CUSTOS_SICRO_OUT2024);
  });

  it("DME com custos SICRO: jazida 8,89 km · alargamento 5,56 km", () => {
    const dme = calcularDME(CUSTOS_SICRO_OUT2024);
    expectClose(dme.jazida.dmeKm, 8.888, 1e-3, 0.001);
    expectClose(dme.alargamento.dmeKm, 5.555, 1e-3, 0.001);
  });
});
