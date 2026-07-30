import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { MtpPacote } from "../../lib/mtp";

// useEstudo exige o <EstudoProvider>; aqui só o `pacote` importa.
const estado: { pacote: MtpPacote } = { pacote: {} as MtpPacote };
vi.mock("../landxml/cenarios/EstudoContext", () => ({
  useEstudo: () => estado,
}));

const { ComparativoSecoesTab } = await import("./ComparativoSecoesTab");

/** Recorte fiel do bloco gerado no BR-376 (números reais de 2026-07-29). */
const BLOCO = {
  versao: 1,
  fonte: "…Wolney com seções do tronco.xml",
  convencao: "terreno × DATUM, CFT fora da conta",
  avisos: ["GEO_CONTORNO_NORTE_A: 1 seção extrapolada descartada (112+7.582)."],
  surf_volumes: [{ nome: "VOLUME-2", corte: 1456939, aterro: 328088.1 }],
  eixos: [
    {
      eixo_id: "GEO_CONTORNO_NORTE_A",
      n: 118,
      n_trunc: 20,
      n_extrap: 1,
      estacas_extrap: ["112+7.582"],
      frac_aterro_trunc: 0.66,
      v_ref: { corte: 152714.1, aterro: 700585.3 },
      v_ref_bruto: { corte: 419760.5, aterro: 700585.3 },
      v_dash: { corte: 133503.5, aterro: 665680.2 },
      linhas: [
        // estaca normal
        {
          sta: 0,
          est: "0+0.000",
          c_ref: 0,
          f_ref: 513.186,
          c_cft: 0,
          f_cft: 497.987,
          vc_ref: 0,
          vf_ref: 11658,
          vc_dash: 0,
          vf_dash: 11200,
          trunc: false,
          extrap: false,
          w_ter: 100,
          w_dat: 62,
        },
        // estaca truncada pela swath (w_dat encosta em w_ter)
        {
          sta: 140,
          est: "7+0.000",
          c_ref: 0,
          f_ref: 1529.7,
          vc_ref: 0,
          vf_ref: 33045,
          vc_dash: 0,
          vf_dash: 31566,
          trunc: true,
          extrap: false,
          w_ter: 100,
          w_dat: 100,
        },
        // estaca extrapolada (o caso 112+7.582)
        {
          sta: 2247.582,
          est: "112+7.582",
          c_ref: 70248.302,
          f_ref: 0,
          vc_ref: null,
          vf_ref: null,
          vc_dash: 994.1,
          vf_dash: 0,
          trunc: false,
          extrap: true,
          w_ter: 90.22,
          w_dat: 76.4,
        },
      ],
    },
    {
      eixo_id: "GEO_CONTORNO_NORTE_B",
      n: 468,
      n_trunc: 4,
      n_extrap: 0,
      estacas_extrap: [],
      frac_aterro_trunc: 0,
      v_ref: { corte: 1457971.1, aterro: 324295.7 },
      v_dash: { corte: 1325750.2, aterro: 297463.5 },
      linhas: [
        // estaca com polígonos da Lista de Materiais do Civil 3D
        {
          sta: 20000,
          est: "1000+0.000",
          c_ref: 169.415,
          f_ref: 0,
          c_cft: 184.631,
          c_mat: 169.432,
          vc_ref: 2874,
          vf_ref: 0,
          vc_dash: 2610,
          vf_dash: 0,
          trunc: false,
          extrap: false,
          w_ter: 90.22,
          w_dat: 37.89,
        },
      ],
    },
  ],
};

describe("ComparativoSecoesTab", () => {
  it("explica a ausência quando o pacote não traz o bloco", () => {
    estado.pacote = {} as MtpPacote;
    const html = renderToStaticMarkup(<ComparativoSecoesTab accent="#8B5E34" />);
    expect(html).toContain("comparativo_secoes");
    expect(html).toContain("sample lines");
  });

  it("renderiza totais, corroboração e o detalhe do primeiro eixo", () => {
    estado.pacote = { comparativo_secoes: BLOCO } as unknown as MtpPacote;
    const html = renderToStaticMarkup(<ComparativoSecoesTab accent="#8B5E34" />);

    // linha de totais dos dois eixos
    expect(html).toContain("GEO_CONTORNO_NORTE_A");
    expect(html).toContain("GEO_CONTORNO_NORTE_B");
    // corte de referência e do pacote, em pt-BR
    expect(html).toContain("152.714");
    expect(html).toContain("133.504");
    // delta percentual do corte do tronco B
    expect(html).toContain("-9,1%");
    // corroboração TIN x TIN
    expect(html).toContain("VOLUME-2");
    expect(html).toContain("1.456.939");
    // aviso + estaca descartada
    expect(html).toContain("112+7.582");
    // nota de truncamento com a fração de aterro afetada
    expect(html).toContain("66%");
    // o bruto expõe o corte fantasma da extrapolação
    expect(html).toContain("419.761");
  });

  it("mostra a área da Lista de Materiais ao lado da de referência", () => {
    estado.pacote = {
      comparativo_secoes: { ...BLOCO, eixos: [BLOCO.eixos[1]] },
    } as unknown as MtpPacote;
    const html = renderToStaticMarkup(<ComparativoSecoesTab accent="#8B5E34" />);
    expect(html).toContain("1000+0.000");
    expect(html).toContain("169,4"); // c_ref
    expect(html).toContain("184,6"); // c_cft (se a CFT entrasse)
  });
});
