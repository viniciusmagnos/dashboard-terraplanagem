/**
 * Golden test de paridade TS ↔ Python do motor de Brückner.
 *
 * O pacote EPR em __fixtures__ foi gerado pelo backend (manta_shared.bruckner,
 * Python) e traz o bloco `bruckner` embutido. Aqui refazemos o MESMO pipeline
 * do dashboard (bins de eixos rodovia → rebinBins → analyzeBruckner com os
 * params do pacote) e comparamos com o resultado embutido. Se qualquer um dos
 * lados (port TS ou motor Python) mudar sozinho, este teste quebra.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { analyzeBruckner, rebinBins, type BrucknerResult } from "./bruckner";
import { validarPacote, type MtpPacote } from "./mtp";

const pacote: MtpPacote = validarPacote(
  readFileSync(
    new URL("./__fixtures__/epr-br365-581-607.mtp.json", import.meta.url),
    "utf-8",
  ),
);

function recalcular(p: MtpPacote): BrucknerResult {
  const params = p.bruckner!.params;
  const rodoviaIds = new Set(
    p.eixos.filter((e) => e.tipo === "rodovia").map((e) => e.id),
  );
  const binsMainline = rebinBins(
    p.bins.filter((b) => rodoviaIds.has(b.eixo_id)),
    p.bins_meta.largura_m,
  );
  return analyzeBruckner(binsMainline, {
    fillFactor: params.fill_factor,
    baseline: params.baseline as "start" | "median" | number,
    barriers: params.barriers,
    gapSplitM: params.gap_split_m,
  });
}

/** |a−b| ≤ abs + rel·|b| (b = referência Python). */
function expectClose(a: number, b: number, rel = 1e-4, abs = 0.5) {
  expect(Math.abs(a - b)).toBeLessThanOrEqual(abs + rel * Math.abs(b));
}

describe("paridade TS ↔ Python (pacote EPR BR-365)", () => {
  const embutido = pacote.bruckner!;
  const recalc = recalcular(pacote);

  it("params equivalentes (n_bins, barreiras)", () => {
    expect(recalc.params.n_bins).toBe(embutido.params.n_bins);
    expect(recalc.params.barriers).toEqual(embutido.params.barriers);
  });

  it("totals batem", () => {
    const chaves = [
      "v_corte",
      "v_aterro",
      "volume_compensado",
      "momento_m3km",
      "sobra_bota_fora",
      "falta_emprestimo",
    ] as const;
    for (const k of chaves) {
      expectClose(recalc.totals[k], embutido.totals[k]);
    }
    expect(recalc.totals.dmt_medio_m).not.toBeNull();
    expectClose(recalc.totals.dmt_medio_m!, embutido.totals.dmt_medio_m!);
  });

  it("segmentos batem (contagem, janelas e residuais)", () => {
    expect(recalc.segments.length).toBe(embutido.segments.length);
    for (let i = 0; i < recalc.segments.length; i++) {
      const r = recalc.segments[i];
      const e = embutido.segments[i];
      expectClose(r.sta_start, e.sta_start, 0, 0.01);
      expectClose(r.sta_end, e.sta_end, 0, 0.01);
      expect(r.reason_start).toBe(e.reason_start);
      expect(r.reason_end).toBe(e.reason_end);
      expectClose(r.residual_m3, e.residual_m3);
      expectClose(r.momento_m3km, e.momento_m3km);
      expectClose(r.volume_compensado, e.volume_compensado);
    }
  });

  it("faixas de DMT (DNIT) batem", () => {
    const tol = embutido.totals.volume_compensado * 1e-3 + 1;
    const labels = new Set([
      ...Object.keys(embutido.faixas),
      ...Object.keys(recalc.faixas),
    ]);
    for (const label of labels) {
      const e = embutido.faixas[label] ?? 0;
      const r = recalc.faixas[label] ?? 0;
      expect(Math.abs(r - e), `faixa ${label}`).toBeLessThanOrEqual(tol);
    }
    const somaR = Object.values(recalc.faixas).reduce((a, v) => a + v, 0);
    expectClose(somaR, recalc.totals.volume_compensado, 1e-3, 1);
  });

  it("curva bate (nº de pontos e extremos)", () => {
    expect(recalc.curve.length).toBe(embutido.curve.length);
    const [s0r, y0r] = recalc.curve[0];
    const [s0e, y0e] = embutido.curve[0];
    expectClose(s0r, s0e, 0, 0.01);
    expectClose(y0r, y0e);
    const [sNr, yNr] = recalc.curve[recalc.curve.length - 1];
    const [sNe, yNe] = embutido.curve[embutido.curve.length - 1];
    expectClose(sNr, sNe, 0, 0.01);
    expectClose(yNr, yNe);
  });
});

describe("sanidade analítica (mesmos casos do test_bruckner.py)", () => {
  it("onda triangular: 500 m³ compensados, 50 m³·km, DMT 100 m", () => {
    // 10 bins de 20 m: corte 100 m³ nos 5 primeiros, aterro 100 m³ nos 5 últimos.
    const bins = Array.from({ length: 10 }, (_, i) => ({
      sta_a: i * 20,
      sta_b: (i + 1) * 20,
      v_corte: i < 5 ? 100 : 0,
      v_aterro: i < 5 ? 0 : 100,
    }));
    const res = analyzeBruckner(bins);
    expect(res.segments.length).toBe(1);
    expectClose(res.totals.volume_compensado, 500, 1e-6, 0.01);
    expectClose(res.totals.momento_m3km, 50, 1e-3, 0.05);
    expectClose(res.totals.dmt_medio_m!, 100, 1e-3, 0.5);
    expectClose(res.totals.sobra_bota_fora, 0, 0, 1e-6);
    expectClose(res.totals.falta_emprestimo, 0, 0, 1e-6);
  });

  it("baseline mediana reduz o momento vs start em curva desequilibrada", () => {
    // Corte forte no início, aterro fraco no fim → residual grande com start.
    const bins = Array.from({ length: 10 }, (_, i) => ({
      sta_a: i * 20,
      sta_b: (i + 1) * 20,
      v_corte: i < 5 ? 200 : 0,
      v_aterro: i < 5 ? 0 : 100,
    }));
    const start = analyzeBruckner(bins, { baseline: "start" });
    const mediana = analyzeBruckner(bins, { baseline: "median" });
    expect(mediana.totals.momento_m3km).toBeLessThan(start.totals.momento_m3km);
  });

  it("barreira divide o segmento e gera residuais nas duas partes", () => {
    const bins = Array.from({ length: 10 }, (_, i) => ({
      sta_a: i * 20,
      sta_b: (i + 1) * 20,
      v_corte: i < 5 ? 100 : 0,
      v_aterro: i < 5 ? 0 : 100,
    }));
    const res = analyzeBruckner(bins, { barriers: [100] });
    expect(res.segments.length).toBe(2);
    expectClose(res.totals.sobra_bota_fora, 500, 1e-6, 0.01);
    expectClose(res.totals.falta_emprestimo, 500, 1e-6, 0.01);
  });
});
