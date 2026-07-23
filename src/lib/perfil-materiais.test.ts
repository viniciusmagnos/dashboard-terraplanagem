import { describe, expect, it } from "vitest";
import { areaMateriaisCorte, furoPerfilMaisProximo } from "./perfil-materiais";
import type { MtpGeoSecao, MtpSondagemPerfil } from "./mtp";

function secao(platZ: number): MtpGeoSecao {
  // terreno plano em z=10 e plataforma plana em platZ, offset [-10, 10]
  return {
    sta_m: 1000,
    terreno: [-10, 10, 10, 10],
    plataforma: [-10, platZ, 10, platZ],
    area_corte: (10 - platZ) * 20,
    area_aterro: 0,
    fonte: "teste",
  };
}

const furo: MtpSondagemPerfil = {
  id: "SP-TESTE",
  tipo: "percussao",
  sta_m: 1005,
  cota_topo_m: 10,
  prof_m: 6,
  na_m: null,
  na_seco: true,
  camadas: [
    { de_m: 0, a_m: 1, material: "camada vegetal", categoria: 1, n_spt: null },
    { de_m: 1, a_m: 3, material: "argila arenosa", categoria: 1, n_spt: 8 },
    { de_m: 3, a_m: 6, material: "areia compacta", categoria: 2, n_spt: 55 },
  ],
};

describe("areaMateriaisCorte", () => {
  it("distribui o corte por material, sem extrapolar quando o furo é mais fundo", () => {
    // corte de 4 m em 20 m de largura = 80 m²; camadas [0-1]/[1-3]/[3-6] → dentro
    // de [0,4]: 1 m + 2 m + 1 m por offset → 20 / 40 / 20 m²
    const r = areaMateriaisCorte(secao(6), furo, 5);
    expect(r).not.toBeNull();
    expect(r!.area_corte_m2).toBeCloseTo(80, 0);
    expect(r!.area_coberta_m2).toBeCloseTo(80, 0); // tudo coberto (corte 4 < furo 6)
    const byMat = Object.fromEntries(r!.itens.map((i) => [i.material, i]));
    expect(byMat["argila arenosa"].area_m2).toBeCloseTo(40, 0);
    expect(byMat["argila arenosa"].fracao).toBeCloseTo(0.5, 2);
    expect(byMat["argila arenosa"].categoria).toBe(1);
    expect(byMat["argila arenosa"].n_min).toBe(8);
    expect(byMat["camada vegetal"].area_m2).toBeCloseTo(20, 0);
    expect(byMat["areia compacta"].area_m2).toBeCloseTo(20, 0);
    expect(byMat["areia compacta"].categoria).toBe(2);
    expect(r!.itens.every((i) => !i.extrapolado)).toBe(true);
    // soma das áreas por material bate com o corte
    const soma = r!.itens.reduce((s, i) => s + i.area_m2, 0);
    expect(soma).toBeCloseTo(80, 0);
  });

  it("extrapola a última camada abaixo do fim do furo", () => {
    // corte de 8 m; furo vai a 6 m → 2 m extrapolados (areia compacta) = 40 m²
    const r = areaMateriaisCorte(secao(2), furo, 5);
    expect(r).not.toBeNull();
    expect(r!.area_corte_m2).toBeCloseTo(160, 0);
    expect(r!.area_coberta_m2).toBeCloseTo(120, 0); // 6 m × 20 m
    const extrap = r!.itens.find((i) => i.extrapolado);
    expect(extrap).toBeTruthy();
    expect(extrap!.material).toBe("areia compacta");
    expect(extrap!.area_m2).toBeCloseTo(40, 0);
    // continua havendo bandas p/ desenhar
    expect(r!.bandas.length).toBeGreaterThan(0);
  });

  it("retorna null quando não há corte", () => {
    // plataforma acima do terreno (aterro puro) → sem corte
    expect(areaMateriaisCorte(secao(12), furo, 5)).toBeNull();
  });
});

describe("furoPerfilMaisProximo", () => {
  it("pega o furo mais próximo dentro da distância máxima", () => {
    const furos: MtpSondagemPerfil[] = [
      { ...furo, id: "A", sta_m: 900 },
      { ...furo, id: "B", sta_m: 1010 },
      { ...furo, id: "C", sta_m: 1500 },
    ];
    const r = furoPerfilMaisProximo(furos, 1000, 300);
    expect(r?.furo.id).toBe("B");
    expect(r?.dist_m).toBe(10);
    // fora do alcance → null
    expect(furoPerfilMaisProximo(furos, 2000, 300)).toBeNull();
    expect(furoPerfilMaisProximo([], 1000)).toBeNull();
  });
});
