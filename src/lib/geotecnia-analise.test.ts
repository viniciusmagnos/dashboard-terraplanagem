import { describe, expect, it } from "vitest";
import {
  bandaDe,
  litologiaCortePorEixo,
  rotuloBanda,
  trechosLitologia,
  trechosUmidade,
  umidadeCortePorEixo,
} from "./geotecnia-analise";
import type {
  MtpBin,
  MtpEnsaioLab,
  MtpGeotecnia,
  MtpPerfilEixo,
  MtpSondagem,
} from "./mtp";

/* ── fixtures ─────────────────────────────────────────────── */

function ensaio(furoId: string, de: number, a: number, w: number, wOt: number | null = null): MtpEnsaioLab {
  return {
    furo_id: furoId, ident: `${furoId} ${de}-${a}`, registro: "0001/2026",
    prof_de_m: de, prof_a_m: a, energia: "PN",
    w_nat_pct: w, w_ot_pct: wOt, gamma_d_max_knm3: null,
    cbr_pct: null, expansao_pct: null, mct: null,
    ll_pct: null, lp_pct: null, ip_pct: null, hrb: null, uscs: null,
    massa_esp_ap_gcm3: null, dens_real_graos: null, granulometria: {}, fonte: "t",
  };
}

function furo(id: string, staM: number, ensaios: MtpEnsaioLab[]): MtpSondagem {
  return {
    id, tipo: "trado", arquivo: `${id}.pdf`, norte: null, este: null,
    cota_m: null, prof_total_m: 10, na_m: null, na_seco: true,
    eixo_id: "E", sta_m: staM, offset_m: 0, camadas: [],
    solo_mole_ate_m: null, impenetravel_m: null, ensaios, confianca: 1,
  };
}

function geoDe(furos: MtpSondagem[], profCorte: number, bins: MtpBin[]): MtpGeotecnia {
  return {
    versao: 1, sondagens: furos,
    resumo: {
      n_total: furos.length, n_posicionadas: furos.length, n_com_coordenada: 0,
      por_tipo: {}, prof_media_m: null, na_medio_m: null,
      n_com_solo_mole: 0, n_com_impenetravel: 0,
    },
    materiais: {
      versao: 1, max_dist_m: 250, cobertura_corte: 1,
      corte_1cat: 0, corte_2cat: 0, corte_3cat: 0, v_solo_mole: 0,
      aterro_solo_mole_km: 0, por_eixo: [],
      bins: bins.map((b) => ({
        eixo_id: b.eixo_id, sta_a: b.sta_a, sta_b: b.sta_b,
        furo_id: "F", dist_m: 5, prof_corte_m: profCorte,
        frac_1cat: 1, frac_2cat: 0, frac_3cat: 0,
        solo_mole: false, solo_mole_esp_m: null,
      })),
      warnings: [],
    },
    params: {}, warnings: [],
  };
}

function bin(staA: number, vCorte: number): MtpBin {
  return { eixo_id: "E", sta_a: staA, sta_b: staA + 20, v_corte: vCorte, v_aterro: 0, v_pavimento: 0 };
}

/* ── umidade ──────────────────────────────────────────────── */

describe("bandaDe / rotuloBanda", () => {
  it("classifica nas bandas padrão", () => {
    expect(bandaDe(10)).toBe(0);
    expect(bandaDe(25)).toBe(1);
    expect(bandaDe(30)).toBe(2);
    expect(bandaDe(55)).toBe(4);
    expect(rotuloBanda(0)).toBe("<20%");
    expect(rotuloBanda(4)).toBe("≥50%");
  });
});

describe("umidadeCortePorEixo", () => {
  const f = furo("ST-1", 10, [ensaio("ST-1", 0, 2, 30, 22), ensaio("ST-1", 2, 4, 55)]);

  it("distribui o corte por amostra sem extrapolar quando o corte = fundo do furo", () => {
    // corte 4 m: amostra1 [0-2] w=30 → 500 m³; amostra2 [2-4] w=55 → 500 m³
    const bins = [bin(0, 1000)];
    const r = umidadeCortePorEixo(bins, geoDe([f], 4, bins), null);
    expect(r).not.toBeNull();
    expect(r!.rows).toHaveLength(1);
    const row = r!.rows[0];
    expect(row.prof_m).toBe(4);
    expect(row.amostras).toHaveLength(2);
    expect(row.amostras[0].v_m3).toBeCloseTo(500, 3);
    expect(row.amostras[1].v_m3).toBeCloseTo(500, 3);
    expect(row.v_sem_ensaio).toBeCloseTo(0, 3);
    const agg = r!.porEixo[0];
    expect(agg.v_coberto).toBeCloseTo(1000, 3);
    // bandas: w=30 → "30–40" (idx 2); w=55 → "≥50" (idx 4)
    expect(agg.porBanda[2]).toBeCloseTo(500, 3);
    expect(agg.porBanda[4]).toBeCloseTo(500, 3);
    expect(agg.w_medio).toBeCloseTo(42.5, 2);
    // só a amostra1 tem w_ot → Δ = 30−22 = 8
    expect(agg.dw_ot).toBeCloseTo(8, 2);
  });

  it("extrapola a última amostra até o fundo do corte", () => {
    // corte 6 m: [0-2] 1/3, [2-4] 1/3, extrapolado [4-6] 1/3 com w=55
    const bins = [bin(0, 900)];
    const r = umidadeCortePorEixo(bins, geoDe([f], 6, bins), null);
    const row = r!.rows[0];
    expect(row.amostras[1].v_m3).toBeCloseTo(300, 3);
    expect(row.amostras[1].v_extrap_m3).toBeCloseTo(300, 3);
    const agg = r!.porEixo[0];
    expect(agg.v_medido).toBeCloseTo(600, 3);
    expect(agg.v_extrapolado).toBeCloseTo(300, 3);
    expect(agg.porBanda[4]).toBeCloseTo(600, 3); // 300 medido + 300 extrapolado
  });

  it("marca lacunas de amostragem como sem ensaio", () => {
    // amostra só de 1 a 2 m; corte 4 m → [0-1] sem ensaio, [2-4] extrapolado
    const fg = furo("ST-2", 10, [ensaio("ST-2", 1, 2, 35)]);
    const bins = [bin(0, 400)];
    const r = umidadeCortePorEixo(bins, geoDe([fg], 4, bins), null);
    const row = r!.rows[0];
    expect(row.v_sem_ensaio).toBeCloseTo(100, 3); // 1 m / 4 m
    expect(row.amostras[0].v_m3).toBeCloseTo(100, 3);
    expect(row.amostras[0].v_extrap_m3).toBeCloseTo(200, 3);
  });

  it("bins longe de qualquer furo ensaiado viram sem furo", () => {
    const bins = [bin(0, 1000), bin(5000, 800)];
    const r = umidadeCortePorEixo(bins, geoDe([f], 4, bins), null);
    expect(r!.rows).toHaveLength(1);
    expect(r!.porEixo[0].v_sem_furo).toBeCloseTo(800, 3);
  });

  it("retorna null sem furos ensaiados", () => {
    const bins = [bin(0, 1000)];
    expect(umidadeCortePorEixo(bins, geoDe([furo("ST-3", 10, [])], 4, bins), null)).toBeNull();
  });
});

describe("trechosUmidade", () => {
  it("agrupa bins contíguos acima do limiar e separa lacunas grandes", () => {
    const f1 = furo("ST-1", 30, [ensaio("ST-1", 0, 4, 55)]);
    const f2 = furo("ST-2", 210, [ensaio("ST-2", 0, 4, 30)]);
    const f3 = furo("ST-3", 410, [ensaio("ST-3", 0, 4, 60)]);
    // bins 0-20/20-40 (perto de f1, w55) · 200-220 (f2, w30) · 400-420 (f3, w60)
    const bins = [bin(0, 100), bin(20, 200), bin(200, 300), bin(400, 500)];
    const geo = geoDe([f1, f2, f3], 4, bins);
    const r = umidadeCortePorEixo(bins, geo, null, { maxDistM: 100 })!;
    const t50 = trechosUmidade(r.rows, 50);
    expect(t50).toHaveLength(2);
    expect(t50[0].sta_a).toBe(0);
    expect(t50[0].sta_b).toBe(40);
    expect(t50[0].v_m3 + t50[0].v_extrap_m3).toBeCloseTo(300, 3);
    expect(t50[0].furos).toEqual(["ST-1"]);
    expect(t50[1].sta_a).toBe(400);
    expect(t50[1].w_medio).toBeCloseTo(60, 2);
    // limiar 20: tudo entra, mas separado pelas lacunas (>1 bin)
    const t20 = trechosUmidade(r.rows, 20);
    expect(t20).toHaveLength(3);
  });
});

/* ── litologia ────────────────────────────────────────────── */

const perfilEixo: MtpPerfilEixo = {
  eixo_id: "E", titulo: "E", sta_min_m: 0, sta_max_m: 100,
  // terreno plano z=10, greide z=4 → corte de 6 m em toda a extensão
  terreno: [[0, 10], [100, 10]],
  greide: [[0, 4], [100, 4]],
  topo_2cat: [], topo_3cat: [], na: [], contatos: [],
  estratos: [
    { formacao: "Fm. X", litologia: "arenito", alteracao: "RAD", material: "RAD arenito", categoria: 3,
      poligonos: [[[0, 0], [100, 0], [100, 7], [0, 7]]] },
    { formacao: "Fm. X", litologia: "argilito", alteracao: "RAM", material: "RAM argilito", categoria: 2,
      poligonos: [[[0, 7], [100, 7], [100, 9], [0, 9]]] },
  ],
  cal: {},
};

describe("litologiaCortePorEixo", () => {
  it("rateia o corte por litologia×categoria + solo residual", () => {
    // coluna de corte [4,10]: arenito cat3 em [4,7] (3 m), argilito cat2 em
    // [7,9] (2 m), solo em [9,10] (1 m) → 1/2, 1/3, 1/6 de 1200 m³
    const bins = [bin(0, 1200)];
    const r = litologiaCortePorEixo(perfilEixo, bins);
    expect(r).not.toBeNull();
    expect(r!.v_corte_total).toBe(1200);
    const by = Object.fromEntries(r!.totais.map((t) => [`${t.litologia}|${t.categoria}`, t.v_m3]));
    expect(by["arenito|3"]).toBeCloseTo(600, 1);
    expect(by["argilito|2"]).toBeCloseTo(400, 1);
    expect(r!.v_solo_m3).toBeCloseTo(200, 1);
    expect(r!.v_coberto).toBeCloseTo(1200, 1);
  });

  it("bin fora do painel fica sem classificação", () => {
    const bins = [bin(0, 600), bin(200, 400)];
    const r = litologiaCortePorEixo(perfilEixo, bins)!;
    expect(r.v_sem_class).toBeCloseTo(400, 1);
  });

  it("retorna null sem estratos ou sem corte", () => {
    expect(litologiaCortePorEixo({ ...perfilEixo, estratos: [] }, [bin(0, 100)])).toBeNull();
    expect(litologiaCortePorEixo(perfilEixo, [{ ...bin(0, 0), v_corte: 0 }])).toBeNull();
  });

  it("SR (solo residual) vira 1ª cat mesmo com categoria 3 gravada (pacote antigo)", () => {
    const pe: MtpPerfilEixo = {
      ...perfilEixo,
      estratos: [
        { formacao: "Fm. X", litologia: "argilito", alteracao: "SR", material: "SR argilito",
          categoria: 3, poligonos: [[[0, 0], [100, 0], [100, 8], [0, 8]]] },
      ],
    };
    const r = litologiaCortePorEixo(pe, [bin(0, 600)])!;
    // coluna [4,10]: SR em [4,8] = 4 m → 1ª cat; solo residual acima [8,10] = 2 m
    expect(r.totais).toHaveLength(1);
    expect(r.totais[0].categoria).toBe(1);
    expect(r.totais[0].v_m3).toBeCloseTo(400, 1);
    const c3 = r.totais.filter((t) => t.categoria === 3).reduce((s, t) => s + t.v_m3, 0);
    expect(c3).toBe(0);
  });

  it("polígonos duplicados do mesmo material não dobram o volume", () => {
    const pe: MtpPerfilEixo = {
      ...perfilEixo,
      estratos: [
        ...(perfilEixo.estratos ?? []),
        // duplicata exata do estrato de arenito (acontece no DWG real)
        { formacao: "Fm. X", litologia: "arenito", alteracao: "RAD", material: "RAD arenito",
          categoria: 3, poligonos: [[[0, 0], [100, 0], [100, 7], [0, 7]]] },
      ],
    };
    const r = litologiaCortePorEixo(pe, [bin(0, 1200)])!;
    const by = Object.fromEntries(r.totais.map((t) => [`${t.litologia}|${t.categoria}`, t.v_m3]));
    expect(by["arenito|3"]).toBeCloseTo(600, 1);
    expect(r.v_solo_m3).toBeCloseTo(200, 1);
  });
});

describe("trechosLitologia", () => {
  it("agrupa bins contíguos com a categoria e detalha por litologia", () => {
    const bins = [bin(0, 600), bin(20, 600), bin(80, 300)];
    const r = litologiaCortePorEixo(perfilEixo, bins)!;
    const t3 = trechosLitologia(r.rows, 3);
    // bins 0-20/20-40 contíguos; 80-100 a 2 bins de distância → separado?
    // gap = 80−40 = 40 = 2 bins > tolBins(1)*20 → fecha; logo 2 trechos
    expect(t3).toHaveLength(2);
    expect(t3[0].sta_a).toBe(0);
    expect(t3[0].sta_b).toBe(40);
    expect(t3[0].v_total_m3).toBeCloseTo(600, 1); // metade de 1200
    expect(t3[0].porLito[0].litologia).toBe("arenito");
    const t2 = trechosLitologia(r.rows, 2);
    expect(t2[0].v_total_m3).toBeCloseTo(400, 1); // 1/3 de 1200
  });
});
