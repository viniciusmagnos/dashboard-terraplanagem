/**
 * Testes do gerador de relatório HTML autocontido do dashboard de
 * terraplenagem. Usa o pacote EPR real (__fixtures__) para montar um
 * CenarioComputado de verdade e valida:
 *  - a montagem do objeto de dados completos (chaves de topo + estado);
 *  - o strip do bloco de geometria na opção "leve";
 *  - a segurança de escape (nome com </script> e & < > " não quebra o
 *    documento nem o bloco JSON embutido, que deve continuar parseável).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  computarCenario,
  custosDoPacote,
  premissasDoPacote,
  type CenarioDef,
  type EntradasProjeto,
} from "./cenario";
import {
  gerarHtmlDashboard,
  montarDadosCompletos,
  nomeArquivo,
  type DadosEstudoInput,
} from "./estudo-html-export";
import { validarPacote, type MtpPacote } from "./mtp";

const pacote: MtpPacote = validarPacote(
  readFileSync(
    new URL("./__fixtures__/epr-br365-581-607.mtp.json", import.meta.url),
    "utf-8",
  ),
);

function entradas(): EntradasProjeto {
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

function montarInput(over: Partial<DadosEstudoInput> = {}): DadosEstudoInput {
  const ent = entradas();
  const casoBase = computarCenario({
    pacote,
    binsMainline: [],
    entradas: ent,
    def: defCasoBase(),
    brucknerPronto: pacote.bruckner,
  });
  return {
    pacote,
    entradas: ent,
    cenarios: [],
    cenarioAtivoId: null,
    casoBase,
    computados: new Map(),
    economias: new Map(),
    ativo: casoBase,
    ativoEconomia: null,
    estudoId: "est-123",
    estudoRole: "owner",
    geradoEm: "2026-07-09T12:00:00.000Z",
    ...over,
  };
}

/** Extrai o texto do bloco JSON embutido no HTML. */
function extrairJson(html: string): string {
  const m = html.match(
    /<script type="application\/json" id="manta-dados">([\s\S]*?)<\/script>/,
  );
  if (!m) throw new Error("bloco #manta-dados não encontrado");
  return m[1];
}

describe("montarDadosCompletos", () => {
  it("tem as chaves de topo e embute o pacote + estado", () => {
    const dados = montarDadosCompletos(montarInput(), {
      incluirGeometria: false,
    }) as any;
    expect(Object.keys(dados).sort()).toEqual(
      ["meta", "resumo", "estado", "cenarios_computados", "pacote"].sort(),
    );
    expect(dados.pacote.schema).toBe(pacote.schema);
    expect(dados.estado.v).toBe(2);
    expect(dados.estado.cenarioAtivoId).toBeNull();
    // caso base sempre presente em cenarios_computados
    expect(dados.cenarios_computados.length).toBeGreaterThanOrEqual(1);
    expect(dados.cenarios_computados[0].is_caso_base).toBe(true);
    expect(dados.cenarios_computados[0].orcamento.total).toBeGreaterThan(0);
  });

  it("inclui os cenários nomeados computados", () => {
    const ent = entradas();
    const def: CenarioDef = { ...defCasoBase(), id: "c1", nome: "Alarg. 15%" };
    def.premissas = {
      ...def.premissas,
      alargamentoCortePercent: 0.15,
      alargamentoAterroPercent: 0.15,
    };
    const comp = computarCenario({
      pacote,
      binsMainline: [],
      entradas: ent,
      def,
      brucknerPronto: pacote.bruckner,
    });
    const dados = montarDadosCompletos(
      montarInput({
        cenarios: [def],
        computados: new Map([["c1", comp]]),
        cenarioAtivoId: "c1",
        ativo: comp,
      }),
      { incluirGeometria: false },
    ) as any;
    const nomes = dados.cenarios_computados.map((c: any) => c.nome);
    expect(nomes).toContain("Alarg. 15%");
    const c1 = dados.cenarios_computados.find((c: any) => c.id === "c1");
    expect(c1.is_ativo).toBe(true);
    // a curva de Brückner (array grande) não é duplicada por cenário
    expect(c1.bruckner?.curve).toBeUndefined();
  });

  it("a opção leve remove o bloco de geometria", () => {
    const comGeo = {
      ...pacote,
      geometria: { world_offset: [0, 0], z_offset_m: 0, eixos: [] },
    } as unknown as MtpPacote;
    const input = montarInput({ pacote: comGeo });

    const cheio = montarDadosCompletos(input, { incluirGeometria: true }) as any;
    expect(cheio.meta.inclui_geometria).toBe(true);
    expect(cheio.pacote.geometria).toBeDefined();

    const leve = montarDadosCompletos(input, { incluirGeometria: false }) as any;
    expect(leve.meta.inclui_geometria).toBe(false);
    expect(leve.pacote.geometria).toBeUndefined();
  });
});

describe("gerarHtmlDashboard", () => {
  it("produz um documento HTML com o bloco de dados embutido e parseável", () => {
    const html = gerarHtmlDashboard(montarInput(), { incluirGeometria: false });
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain('id="manta-dados"');
    expect(html).toContain(pacote.projeto.nome);

    const json = extrairJson(html);
    const parsed = JSON.parse(json);
    expect(parsed.pacote.schema).toBe(pacote.schema);
    expect(parsed.meta.estudo_id).toBe("est-123");
    expect(parsed.resumo.custos_referencia).toBeTruthy();
  });

  it("inclui abas e gráficos SVG (Brückner + composição do orçamento)", () => {
    const html = gerarHtmlDashboard(montarInput(), { incluirGeometria: false });
    // barra de abas
    expect(html).toContain('data-tab="bruckner"');
    expect(html).toContain('data-tab="orcamento"');
    expect(html).toContain('id="tab-visao"');
    // gráficos SVG (o pacote EPR tem Brückner embutido)
    expect(html).toContain('<svg class="chart"');
    // segundo bloco JSON (mapa de seções) presente e parseável
    const m = html.match(
      /<script type="application\/json" id="manta-secoes">([\s\S]*?)<\/script>/,
    );
    expect(m).toBeTruthy();
    expect(() => JSON.parse(m![1])).not.toThrow();
  });

  it("escapa nome com </script> e caracteres perigosos sem quebrar o JSON", () => {
    const nomeMalicioso = 'A</script><b>"&</b> & <x>';
    const pacoteMal = {
      ...pacote,
      projeto: { ...pacote.projeto, nome: nomeMalicioso },
    } as MtpPacote;
    const html = gerarHtmlDashboard(montarInput({ pacote: pacoteMal }), {
      incluirGeometria: false,
    });

    // O título/cabeçalho vem escapado (nenhum </script> cru fora do bloco JSON).
    expect(html).toContain("&lt;/script&gt;");
    // O bloco JSON não contém "</script" cru (todo "<" virou <).
    const json = extrairJson(html);
    expect(json).not.toContain("</script");
    // ... e ainda assim faz round-trip com o nome original.
    const parsed = JSON.parse(json);
    expect(parsed.pacote.projeto.nome).toBe(nomeMalicioso);
  });

  it("nomeArquivo higieniza o id do projeto", () => {
    const p = { projeto: { id: "EPR BR-365/581", nome: "x" } } as MtpPacote;
    expect(nomeArquivo(p, "html")).toBe("EPR-BR-365-581.html");
    expect(nomeArquivo(p, "json", "-dados")).toBe("EPR-BR-365-581-dados.json");
  });

  it("inclui a aba Drenagem quando o pacote tem o bloco (e omite quando não)", () => {
    // sem bloco → sem aba
    const htmlSem = gerarHtmlDashboard(montarInput(), { incluirGeometria: false });
    expect(htmlSem).not.toContain('data-tab="drenagem"');

    const pacoteDre = {
      ...pacote,
      drenagem: {
        versao: 1,
        dispositivos: [
          {
            id: "DR-2S-0001",
            familia: "sarjeta",
            tipo_codigo: "DR-2S",
            eixo_id: pacote.eixos[0]?.id,
            lado: "D",
            sta_ini_m: 582000,
            sta_fim_m: 582120,
            extensao_m: 120,
            quantidade: 1,
            unidade: "m",
            status: "projetado",
            folha: "H2-002",
            fonte: "pdf_planta",
          },
        ],
        travessias: [
          {
            id: "TRV-1",
            tipo: "BSTC",
            n_linhas: 1,
            dimensoes: { secao: "Ø 0,80" },
            comprimento_m: 18,
            km: "582+100,00",
            sta_m: 582100,
            status: "existente",
            fontes: ["h1"],
          },
        ],
        bacias: [{ id: "1D", area_km2: 4.465, area_ha: 446.5 }],
        resumo: {
          n_dispositivos: 1,
          n_travessias: 1,
          n_bacias: 1,
          extensao_total_m: 120,
          por_familia: [
            { familia: "sarjeta", unidade: "m", n: 1, extensao_m: 120 },
          ],
          por_eixo: [
            { eixo_id: pacote.eixos[0]?.id ?? "E1", n_dispositivos: 1, extensao_m: 120 },
          ],
          travessias_por_tipo: { BSTC: 1 },
          por_status: { projetado: 1, existente: 1 },
          cobertura: {
            n_folhas_pdf: 1,
            folhas: ["H2-002"],
            folhas_ausentes: ["H2-003 (crescente)"],
            sentidos: { crescente: "folhas 002–002 (1)" },
            fontes: { pdf_planta: 1 },
          },
        },
        familias: { "DR-2S": "sarjeta" },
        params: {},
        fontes: [],
        warnings: [],
      },
    } as MtpPacote;

    const html = gerarHtmlDashboard(montarInput({ pacote: pacoteDre }), {
      incluirGeometria: false,
    });
    expect(html).toContain('data-tab="drenagem"');
    expect(html).toContain("Drenagem (1)");
    expect(html).toContain("DR-2S");
    expect(html).toContain("Cobertura parcial das pranchas");
    expect(html).toContain("Travessias e bueiros");

    // o resumo do JSON embutido ganha os KPIs de drenagem e o pacote leva o bloco
    const parsed = JSON.parse(extrairJson(html));
    expect(parsed.resumo.tem_drenagem).toBe(true);
    expect(parsed.resumo.n_dispositivos_drenagem).toBe(1);
    expect(parsed.resumo.extensao_drenagem_m).toBe(120);
    expect(parsed.pacote.drenagem.dispositivos).toHaveLength(1);
  });
});
