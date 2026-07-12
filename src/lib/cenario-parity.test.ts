/**
 * Golden de paridade TS ↔ Python do MOTOR DE CENÁRIOS (camada econômica).
 *
 * Complementa o bruckner.test.ts (paridade da física): aqui o alvo é
 * `manta_shared/cenario.py` ↔ `lib/cenario.ts`. Os DOIS lados leem os
 * inputs do próprio golden (`__fixtures__/cenario-golden.json`) e comparam
 * seus resultados com os valores esperados — se qualquer port mudar
 * sozinho, um dos lados quebra.
 *
 * O golden é gerado por ESTE arquivo (lado TS é a referência):
 *   UPDATE_GOLDEN=1 npx vitest run src/lib/cenario-parity.test.ts
 * (também é gerado automaticamente se o fixture ainda não existir).
 *
 * Espelho Python: tests/landxml/test_cenario_parity.py
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { rebinBins } from "./bruckner";
import {
  calcularDME,
  calcularEconomia,
  computarCenario,
  custosDoPacote,
  premissasDoPacote,
  type CenarioComputado,
  type CenarioDef,
  type Economia,
  type EntradasProjeto,
} from "./cenario";
import { validarPacote, type MtpPacote } from "./mtp";

const GOLDEN_URL = new URL("./__fixtures__/cenario-golden.json", import.meta.url);

const pacote: MtpPacote = validarPacote(
  readFileSync(
    new URL("./__fixtures__/epr-br365-581-607.mtp.json", import.meta.url),
    "utf-8",
  ),
);

/* ── Inputs canônicos (persistidos no golden p/ o lado Python) ── */

function entradasDoPacoteLocal(p: MtpPacote): EntradasProjeto {
  return {
    cftBase: p.volumes_base.cftBase ?? null,
    soloMole: p.volumes_base.soloMole ?? null,
    soloMoleCompactado: p.volumes_base.soloMoleCompactado ?? null,
    pct3Cat: p.categorias.pct_3cat_default,
    pct2Cat: p.categorias.pct_2cat_default,
    custos: custosDoPacote(p),
    custosEditados: false,
  };
}

function casoBaseDef(p: MtpPacote): CenarioDef {
  const params = p.bruckner?.params;
  return {
    id: "caso-base",
    nome: "Caso base",
    criadoEm: p.generated_at,
    bruckner: {
      fillFactor: params?.fill_factor ?? 1.0,
      baseline: params?.baseline === "median" ? "median" : "start",
      barreirasAtivas: params?.barriers ?? pacote.barreiras.map((b) => b.sta_m),
      barreirasExtras: [],
    },
    premissas: premissasDoPacote(p),
  };
}

const entradasBase = entradasDoPacoteLocal(pacote);

// cen-a: mexe na FÍSICA (fator, baseline, barreiras) + premissas econômicas.
const CEN_A: CenarioDef = {
  id: "cen-a",
  nome: "Cenário A (física)",
  criadoEm: "2026-07-07T00:00:00.000Z",
  bruckner: {
    fillFactor: 1.25,
    baseline: "median",
    barreirasAtivas: [],
    barreirasExtras: [{ sta_m: 594000, nome: "OAE hipotética" }],
  },
  premissas: {
    ...premissasDoPacote(pacote),
    cftPercent: 0.5,
    alargamentoCortePercent: 0.05,
    alargamentoAterroPercent: 0.03,
    dmtJazidaForaFaixa: 12,
  },
};

// cen-b: mexe nas ENTRADAS de projeto (CFT, solo mole, % 3ª cat, custo editado).
const ENTRADAS_B_OVERRIDES = {
  cftBase: 50_000,
  soloMole: 12_000,
  pct3Cat: 0.08,
  transporte: 3.1, // custo editado (custosEditados = true)
};

const entradasB: EntradasProjeto = {
  ...entradasBase,
  cftBase: ENTRADAS_B_OVERRIDES.cftBase,
  soloMole: ENTRADAS_B_OVERRIDES.soloMole,
  pct3Cat: ENTRADAS_B_OVERRIDES.pct3Cat,
  custos: { ...entradasBase.custos, transporte: ENTRADAS_B_OVERRIDES.transporte },
  custosEditados: true,
};

const CEN_B: CenarioDef = {
  id: "cen-b",
  nome: "Cenário B (entradas)",
  criadoEm: "2026-07-07T00:00:00.000Z",
  bruckner: casoBaseDef(pacote).bruckner,
  premissas: premissasDoPacote(pacote),
};

/* ── Cômputo (mesmo pipeline do EstudoContext) ────────────── */

const rodoviaIds = new Set(
  pacote.eixos.filter((e) => e.tipo === "rodovia").map((e) => e.id),
);
const binsMainline = rebinBins(
  pacote.bins.filter((b) => rodoviaIds.has(b.eixo_id)),
  pacote.bins_meta.largura_m,
);

const casoBase = computarCenario({
  pacote,
  binsMainline,
  entradas: entradasBase,
  def: casoBaseDef(pacote),
  brucknerPronto: pacote.bruckner ?? null,
});
const cenA = computarCenario({
  pacote,
  binsMainline,
  entradas: entradasBase,
  def: CEN_A,
});
const economiaA = calcularEconomia(
  casoBase.orcamento,
  cenA.orcamento,
  casoBase.volumes,
  cenA.volumesCalc,
  entradasBase.custos,
  CEN_A.premissas,
);

// cen-b muda entradas de PROJETO → o caso base dele também usa entradasB.
const casoBaseB = computarCenario({
  pacote,
  binsMainline,
  entradas: entradasB,
  def: casoBaseDef(pacote),
  brucknerPronto: pacote.bruckner ?? null,
});
const cenB = computarCenario({
  pacote,
  binsMainline,
  entradas: entradasB,
  def: CEN_B,
});
const economiaB = calcularEconomia(
  casoBaseB.orcamento,
  cenB.orcamento,
  casoBaseB.volumes,
  cenB.volumesCalc,
  entradasB.custos,
  CEN_B.premissas,
);

const dme = calcularDME(entradasBase.custos);

function snapshot(c: CenarioComputado, economia?: Economia) {
  return {
    volumes: c.volumes,
    volumesCalc: c.volumesCalc,
    momento: c.momento,
    orcamento: c.orcamento,
    bruckner_totals: c.bruckner?.totals ?? null,
    ...(economia ? { economia } : {}),
  };
}

const golden = {
  _comment:
    "Golden de paridade do motor de cenários (lado TS é a referência). " +
    "Regerar com: UPDATE_GOLDEN=1 npx vitest run src/lib/cenario-parity.test.ts",
  inputs: {
    cen_a: CEN_A,
    cen_b: CEN_B,
    entradas_b_overrides: ENTRADAS_B_OVERRIDES,
  },
  expected: {
    caso_base: snapshot(casoBase),
    cen_a: snapshot(cenA, economiaA),
    caso_base_b: snapshot(casoBaseB),
    cen_b: snapshot(cenB, economiaB),
    dme_km: {
      jazida: dme.jazida.dmeKm,
      alargamento: dme.alargamento.dmeKm,
      botaFora: dme.botaFora.dmeKm,
    },
  },
};

if (process.env.UPDATE_GOLDEN === "1" || !existsSync(GOLDEN_URL)) {
  writeFileSync(GOLDEN_URL, JSON.stringify(golden, null, 1), "utf-8");
  // eslint-disable-next-line no-console
  console.log(`[cenario-parity] golden regravado em ${GOLDEN_URL.pathname}`);
}

/* ── Comparação recursiva vs golden ───────────────────────── */

/** |a−b| ≤ abs + rel·|b|. Bruckner recomputado → tolerância folgada. */
function expectClose(a: number, b: number, path: string, rel = 1e-4, abs = 0.5) {
  expect(Math.abs(a - b), path).toBeLessThanOrEqual(abs + rel * Math.abs(b));
}

function compareDeep(atual: unknown, esperado: unknown, path: string) {
  if (typeof esperado === "number" && typeof atual === "number") {
    expectClose(atual, esperado, path);
    return;
  }
  if (esperado === null || typeof esperado !== "object") {
    expect(atual, path).toEqual(esperado);
    return;
  }
  if (Array.isArray(esperado)) {
    expect(Array.isArray(atual), path).toBe(true);
    expect((atual as unknown[]).length, path).toBe(esperado.length);
    esperado.forEach((v, i) => compareDeep((atual as unknown[])[i], v, `${path}[${i}]`));
    return;
  }
  for (const [k, v] of Object.entries(esperado)) {
    compareDeep((atual as Record<string, unknown>)[k], v, `${path}.${k}`);
  }
}

describe("paridade motor de cenários TS ↔ golden (espelho do Python)", () => {
  const salvo = JSON.parse(readFileSync(GOLDEN_URL, "utf-8")) as typeof golden;

  it("caso base bate com o golden", () => {
    compareDeep(golden.expected.caso_base, salvo.expected.caso_base, "caso_base");
  });

  it("cen-a (física alterada) bate com o golden", () => {
    compareDeep(golden.expected.cen_a, salvo.expected.cen_a, "cen_a");
  });

  it("cen-b (entradas alteradas) bate com o golden", () => {
    compareDeep(golden.expected.caso_base_b, salvo.expected.caso_base_b, "caso_base_b");
    compareDeep(golden.expected.cen_b, salvo.expected.cen_b, "cen_b");
  });

  it("DME bate com o golden", () => {
    compareDeep(golden.expected.dme_km, salvo.expected.dme_km, "dme_km");
  });

  it("sanidade: economia A tem os 3 vetores coerentes", () => {
    const e = golden.expected.cen_a.economia!;
    expectClose(e.cft.total, e.cft.escavacao + e.cft.compactacao + e.cft.transporte, "cft.total", 1e-9, 1e-6);
    expectClose(e.royalty.total, e.royalty.jazida + e.royalty.botaFora, "royalty.total", 1e-9, 1e-6);
  });
});
