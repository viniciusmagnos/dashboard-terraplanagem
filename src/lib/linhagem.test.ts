import { describe, expect, it } from "vitest";
import fixture from "./__fixtures__/epr-br365-581-607.mtp.json";
import { provenanceDe, validarPacote, type MtpPacote } from "./mtp";
import {
  CATALOGO,
  avisosRelacionados,
  blocoPresente,
  blocosDeExemplo,
  cadeiaDeOrigem,
  campoDoCatalogo,
  camposDoPacote,
  catalogoParaCsv,
  catalogoParaMarkdown,
  contagemProveniencia,
  exemplosNaTela,
  faixasContiguas,
  fontesDoPacote,
  linhagemDe,
  metodoExplicacao,
  metodoRotulo,
  metodosPorEixo,
  provDeclarada,
} from "./linhagem";

/** Pacote real do estudo Duplicação 365 (EPR BR-365 km 581-607), schema v1. */
const pacote = validarPacote(fixture as unknown);

/** Pacote sintético só com o bloco `geometria`, para o método por seção. */
function comGeometria(secoes: { sta_m: number; fonte: string }[]): MtpPacote {
  return {
    ...pacote,
    geometria: {
      world_offset: [0, 0],
      z_offset_m: 0,
      params: {},
      warnings: ["seções reconstruídas no trecho final"],
      eixos: [
        {
          eixo_id: "EIXO-A",
          tracado: null,
          perfil: null,
          secoes_passo_m: 20,
          secoes: secoes.map((s) => ({
            sta_m: s.sta_m,
            terreno: [],
            plataforma: [],
            area_corte: 0,
            area_aterro: 0,
            fonte: s.fonte,
          })),
        },
      ],
    },
  } as unknown as MtpPacote;
}

describe("linhagem — catálogo", () => {
  it("resolve a chave exata e cai para o bloco quando a chave é pontuada", () => {
    expect(campoDoCatalogo("volumes_base.corteTotal")?.chave).toBe(
      "volumes_base.corteTotal",
    );
    expect(campoDoCatalogo("eixos")?.chave).toBe("eixos");
    // `geometria.eixos` não está no catálogo — cai para o bloco `geometria`.
    expect(campoDoCatalogo("geometria.eixos")?.chave).toBe("geometria");
    expect(campoDoCatalogo("bloco_inexistente")).toBeNull();
  });

  it("não tem chave duplicada", () => {
    const chaves = CATALOGO.map((c) => c.chave);
    expect(new Set(chaves).size).toBe(chaves.length);
  });

  it("toda entrada declara origem, transformação e onde aparece", () => {
    for (const c of CATALOGO) {
      expect(c.origem, c.chave).toBeTruthy();
      expect(c.transformacao, c.chave).toBeTruthy();
      expect(c.rotulo, c.chave).toBeTruthy();
      expect(Array.isArray(c.abas), c.chave).toBe(true);
    }
  });
});

describe("linhagem — presença de bloco", () => {
  it("trata objeto de arrays vazios como ausente", () => {
    // `recursos: { jazidas: [], botaForas: [] }` existe mas não tem conteúdo.
    expect(blocoPresente(pacote, "recursos")).toBe(false);
    expect(blocoPresente(pacote, "eixos")).toBe(true);
    expect(blocoPresente(pacote, "volumes_base")).toBe(true);
  });

  it("trata bloco null e bloco inexistente como ausente", () => {
    expect(blocoPresente(pacote, "sondagens")).toBe(false); // null no pacote
    expect(blocoPresente(pacote, "cronograma")).toBe(false); // chave ausente
    expect(blocoPresente(null, "eixos")).toBe(false);
  });
});

describe("linhagem — resolução por chave", () => {
  it("resolve proveniência, valor e situação de um volume extraído", () => {
    const l = linhagemDe(pacote, "volumes_base.corteTotal");
    expect(l.prov).toBe("extracted");
    expect(l.situacao).toBe("presente");
    expect(l.valor).toContain("m³");
    expect(l.campo?.caveat).toMatch(/QTO/);
    expect(l.arquivos).toHaveLength(5);
  });

  it("marca como ausente o bloco que o pacote só reserva no provenance", () => {
    const l = linhagemDe(pacote, "cronograma");
    expect(l.prov).toBe("example");
    // O ponto central: `example` aqui NÃO significa número de demonstração na
    // tela — o bloco não vem no pacote.
    expect(l.situacao).toBe("ausente");
  });

  it("herda a proveniência declarada para o bloco", () => {
    // provenanceDe faz fallback `bloco.campo` → `bloco`; `categorias` existe.
    const l = linhagemDe(pacote, "categorias.pct_3cat_default");
    expect(l.prov).toBe("default");
    expect(l.provInferida).toBe(false);
  });

  it("infere do catálogo em vez de afirmar 'manual' quando nada é declarado", () => {
    // `volumes_base.pavimento` não está no mapa (nem o prefixo `volumes_base`).
    // O fallback do provenanceDe é "manual" — o que MENTIRIA: o pavimento é
    // medido nas seções do LandXML.
    expect(provenanceDe(pacote, "volumes_base.pavimento")).toBe("manual");
    const l = linhagemDe(pacote, "volumes_base.pavimento");
    expect(l.prov).toBe("extracted");
    expect(l.provInferida).toBe(true);
  });

  it("infere 'computed' para volume derivado de percentual", () => {
    const l = linhagemDe(pacote, "volumes_base.corte3Cat");
    expect(l.prov).toBe("computed");
    expect(l.provInferida).toBe(true);
    // Nulo no pacote: resolvido no cenário, não "—".
    expect(l.valor).toBeNull();
  });

  it("não marca como inferida a chave que o pacote declara", () => {
    expect(provDeclarada(pacote, "volumes_base.corteTotal")).toBe(true);
    expect(provDeclarada(pacote, "volumes_base.pavimento")).toBe(false);
    expect(linhagemDe(pacote, "volumes_base.corteTotal").provInferida).toBe(false);
  });
});

describe("linhagem — dados de exemplo", () => {
  it("lista as chaves marcadas como example", () => {
    expect(blocosDeExemplo(pacote).sort()).toEqual([
      "cronograma",
      "praticabilidade",
      "produtividades",
      "transferencias_equipamentos",
    ]);
  });

  it("não acusa demonstração na tela quando os blocos não vêm no pacote", () => {
    expect(exemplosNaTela(pacote)).toEqual([]);
  });

  it("acusa demonstração quando o bloco example existe de fato", () => {
    const p = {
      ...pacote,
      cronograma: { versao: 1, tarefas: [{ id: "t1" }] },
    } as unknown as MtpPacote;
    expect(exemplosNaTela(p)).toEqual(["cronograma"]);
  });
});

describe("linhagem — avisos relacionados", () => {
  it("liga o aviso de estaqueamento próprio ao Brückner e aos eixos", () => {
    expect(avisosRelacionados(pacote, "bruckner").join(" ")).toMatch(
      /estaqueamento próprio/,
    );
    expect(avisosRelacionados(pacote, "eixos").length).toBeGreaterThan(0);
  });

  it("liga o aviso de lacuna aos bins", () => {
    expect(avisosRelacionados(pacote, "bins").join(" ")).toMatch(/lacuna/);
  });

  it("não vaza aviso para bloco sem relação", () => {
    expect(avisosRelacionados(pacote, "custos")).toEqual([]);
  });

  it("inclui os warnings do próprio bloco geometria", () => {
    const p = comGeometria([{ sta_m: 0, fonte: "terrain_datum" }]);
    expect(avisosRelacionados(p, "geometria").join(" ")).toMatch(
      /reconstruídas no trecho final/,
    );
  });
});

describe("linhagem — método por seção", () => {
  it("retorna vazio quando o pacote não tem geometria", () => {
    expect(metodosPorEixo(pacote)).toEqual([]);
  });

  it("conta e ordena os métodos por fidelidade à fonte", () => {
    const p = comGeometria([
      { sta_m: 0, fonte: "talude_inferred_reconstructed" },
      { sta_m: 20, fonte: "terrain_datum" },
      { sta_m: 40, fonte: "terrain_datum" },
      { sta_m: 60, fonte: "datum_tin_cut" },
    ]);
    const [m] = metodosPorEixo(p);
    expect(m.eixoId).toBe("EIXO-A");
    expect(m.total).toBe(4);
    // terrain_datum (mais fiel) primeiro, reconstruída por último.
    expect(m.porFonte.map((f) => f.fonte)).toEqual([
      "terrain_datum",
      "datum_tin_cut",
      "talude_inferred_reconstructed",
    ]);
    expect(m.porFonte[0].n).toBe(2);
    expect(m.porFonte[0].pct).toBeCloseTo(50);
  });

  it("agrupa estações contíguas e separa quando há lacuna", () => {
    expect(faixasContiguas([0, 20, 40], 20)).toEqual(["km 0+000 → km 0+040"]);
    expect(faixasContiguas([0, 20, 500, 520], 20)).toEqual([
      "km 0+000 → km 0+020",
      "km 0+500 → km 0+520",
    ]);
    expect(faixasContiguas([100], 20)).toEqual(["km 0+100"]);
    expect(faixasContiguas([], 20)).toEqual([]);
  });

  it("resume quando há faixas demais", () => {
    const stas = Array.from({ length: 10 }, (_, i) => i * 1000);
    const f = faixasContiguas(stas, 20, 3);
    expect(f).toHaveLength(4);
    expect(f[3]).toBe("+7 faixa(s)");
  });

  it("rotula método composto e explica o terreno sintético", () => {
    expect(metodoRotulo("terrain_datum+synthTN")).toBe(
      "seção absoluta (TN + DATUM) · terreno do TIN",
    );
    expect(metodoRotulo("datum_tin_cut")).toBe("corte na TIN do DATUM");
    expect(metodoExplicacao("terrain_datum+synthTN")).toMatch(/amostrada da TIN/);
    expect(metodoRotulo("modo_novo_do_backend")).toBe("modo_novo_do_backend");
  });
});

describe("linhagem — gerador e cadeia", () => {
  it("expõe ferramenta, modo e arquivos declarados", () => {
    const f = fontesDoPacote(pacote);
    expect(f.tool).toBe("manta-hub/landxml");
    expect(f.mode).toBe("cli");
    expect(f.arquivos).toHaveLength(5);
    expect(f.arquivos[0].filename).toMatch(/C3D-ETM-365MG/);
  });

  it("monta a cadeia citando a contagem de arquivos e a ferramenta", () => {
    const c = cadeiaDeOrigem(pacote);
    expect(c).toHaveLength(5);
    expect(c[1].detalhe).toMatch(/5 arquivo\(s\)/);
    expect(c[2].detalhe).toMatch(/manta-hub\/landxml/);
  });

  it("degrada sem gerador", () => {
    const f = fontesDoPacote(null);
    expect(f.arquivos).toEqual([]);
    expect(cadeiaDeOrigem(null)).toHaveLength(5);
  });
});

describe("linhagem — cobertura do pacote", () => {
  it("inclui os blocos presentes e os reservados no provenance", () => {
    const chaves = camposDoPacote(pacote).map((l) => l.chave);
    expect(chaves).toContain("volumes_base.corteTotal");
    expect(chaves).toContain("eixos");
    expect(chaves).toContain("cronograma"); // reservado, exposto como lacuna
    // Blocos que este pacote v1 nem declara nem traz ficam fora.
    expect(chaves).not.toContain("tempo_caminho");
    expect(chaves).not.toContain("drenagem");
  });

  it("conta as chaves por classe de proveniência", () => {
    const c = contagemProveniencia(pacote);
    expect(c.extracted).toBe(5);
    expect(c.example).toBe(4);
    expect(c.computed).toBe(3);
  });
});

describe("linhagem — export do catálogo", () => {
  const linhas = camposDoPacote(pacote);

  it("gera CSV com cabeçalho e uma linha por campo", () => {
    const csv = catalogoParaCsv(linhas);
    const l = csv.split("\r\n");
    expect(l[0]).toBe(
      "campo;rotulo;valor_atual;proveniencia;proveniencia_inferida;bloco_no_pacote;origem_tipo;origem;transformacao;escopo;ressalva;abas",
    );
    expect(l).toHaveLength(linhas.length + 1);
  });

  it("escapa aspas dentro das células", () => {
    const csv = catalogoParaCsv([
      { ...linhas[0], valor: 'tem "aspas" aqui' },
    ]);
    expect(csv).toContain('"tem ""aspas"" aqui"');
  });

  it("gera Markdown com o título e uma seção por campo", () => {
    const md = catalogoParaMarkdown(linhas, "Duplicação 365");
    expect(md).toMatch(/^# Rastreabilidade de dados — Duplicação 365/);
    expect(md).toContain("- **Campo:** `volumes_base.corteTotal`");
    expect(md).toContain("- **Proveniência:** extracted");
  });
});
