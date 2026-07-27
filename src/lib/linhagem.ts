// =====================================================
// Catálogo de LINHAGEM dos dados do dashboard.
//
// Responde "de onde vem cada dado": arquivo-fonte → entidade LandXML →
// transformação → classe de proveniência.
//
// O catálogo descreve o SCHEMA do `.mtp.json` (manta-terraplenagem-package),
// não um projeto específico. Tudo que é específico do estudo carregado
// (arquivos, superfícies, métodos por seção, avisos, valores) é resolvido em
// RUNTIME a partir do pacote. Nada hardcoded por projeto.
//
// As chaves são as MESMAS que `provenanceDe` (mtp.ts) já entende — com
// fallback `bloco.campo` → `bloco` → `manual` — então casam com os `bloco=`
// que as abas já passam ao chip de proveniência.
//
// APP-LOCAL: não adicionar ao sync-from-hub.
// =====================================================

import { fmt, fmtBRL } from "./format";
import {
  provenanceDe,
  staToKmLabel,
  type MtpGeoEixo,
  type MtpGeometria,
  type MtpPacote,
  type Provenance,
} from "./mtp";

/* ── Tipos ────────────────────────────────────────────────── */

/** Natureza da origem física do dado. */
export type OrigemTipo =
  | "landxml-tin"
  | "landxml-alinhamento"
  | "landxml-secao"
  | "landxml-perfil"
  | "prancha"
  | "calculo"
  | "calculo-navegador"
  | "premissa"
  | "manual";

/**
 * Classe de proveniência implícita em cada tipo de origem. Usada só quando o
 * pacote NÃO declara a chave: `provenanceDe` devolve "manual" como fallback, o
 * que afirmaria entrada manual para dado que veio do LandXML (ex.:
 * `volumes_base.pavimento`, que o mapa não lista). Inferir do catálogo e marcar
 * como inferido é honesto; repetir o fallback não é.
 */
export const CLASSE_POR_ORIGEM: Record<OrigemTipo, Provenance> = {
  "landxml-tin": "extracted",
  "landxml-alinhamento": "extracted",
  "landxml-secao": "extracted",
  "landxml-perfil": "extracted",
  prancha: "manual",
  calculo: "computed",
  "calculo-navegador": "computed",
  premissa: "default",
  manual: "manual",
};

export const ORIGEM_ROTULO: Record<OrigemTipo, string> = {
  "landxml-tin": "Superfície TIN (LandXML)",
  "landxml-alinhamento": "Alinhamento (LandXML)",
  "landxml-secao": "Seção transversal (LandXML)",
  "landxml-perfil": "Perfil vertical / greide (LandXML)",
  prancha: "Prancha de projeto (DWG/PDF)",
  calculo: "Cálculo do adaptador",
  "calculo-navegador": "Cálculo ao vivo no navegador",
  premissa: "Premissa de projeto",
  manual: "Entrada manual / importação",
};

export interface CampoLinhagem {
  /** Chave de proveniência (a mesma que `provenanceDe` resolve). */
  chave: string;
  rotulo: string;
  unidade?: string;
  origemTipo: OrigemTipo;
  /** Entidade LandXML / documento de origem, em texto. */
  origem: string;
  /** A transformação aplicada, em palavras. */
  transformacao: string;
  /** O que o número mede (escopo). */
  escopo?: string;
  /** Ressalva importante — o que ele NÃO é. */
  caveat?: string;
  /** Sub-abas do dashboard onde o dado aparece (ids do NAV). */
  abas: string[];
  /** Recalculado no navegador a cada render (cenários). */
  aoVivo?: boolean;
  /** Valor atual, formatado — para o catálogo. */
  valorDe?: (p: MtpPacote) => string | null;
}

/* ── Catálogo ─────────────────────────────────────────────── */

const TIN_PAR =
  "terreno natural (TIN de levantamento) × plataforma de projeto (superfície DATUM do corredor)";

/** null (não "—") quando o pacote não traz o número: quem exibe decide o texto. */
const m3 = (v: number | null | undefined): string | null =>
  v == null ? null : `${fmt(v)} m³`;

export const CATALOGO: CampoLinhagem[] = [
  /* — Eixos e extensões — */
  {
    chave: "eixos",
    rotulo: "Eixos, estaqueamento e extensões por eixo",
    origemTipo: "landxml-alinhamento",
    origem: "<Alignment> de cada recorte LandXML (nome, staStart, length)",
    transformacao:
      "Lido direto do alinhamento; o tipo (rodovia/acesso/rotatória/transição) é inferido do nome e da extensão.",
    escopo: "Geometria horizontal do projeto, como exportada do Civil 3D.",
    caveat:
      "Eixos com estaqueamento próprio (rotatórias, transições) não entram no Brückner global — veja os avisos do pacote.",
    abas: ["visao", "dash-rodovias", "dados-rodovias"],
    valorDe: (p) => `${p.eixos.length} eixo(s)`,
  },
  {
    chave: "extensoes",
    rotulo: "Extensão total, com/sem serviço, principais e acessos",
    unidade: "km",
    origemTipo: "calculo",
    origem: "Alinhamentos + presença de seções com serviço",
    transformacao:
      "Σ das extensões dos alinhamentos, separada por tipo de eixo; 'com serviço' = trechos que têm seção com área de corte ou aterro.",
    abas: ["visao", "resumo-exec", "cen-custo-km"],
    valorDe: (p) => `${fmt(p.extensoes.total, 2)} km`,
  },
  {
    chave: "barreiras",
    rotulo: "Barreiras de compensação (OAEs)",
    origemTipo: "prancha",
    origem: "Obras de arte especiais identificadas nas pranchas / hidrologia",
    transformacao:
      "Cada barreira vira um corte na curva de massas: material não é compensado através dela.",
    caveat:
      "Se uma OAE não estiver cadastrada, o Brückner compensa material por cima dela e subestima o transporte.",
    abas: ["bruckner", "cen-momento"],
    valorDe: (p) => `${p.barreiras.length} barreira(s)`,
  },

  /* — Volumes — */
  {
    chave: "volumes_base.corteTotal",
    rotulo: "Corte total",
    unidade: "m³",
    origemTipo: "landxml-secao",
    origem: `Seções transversais (<CrossSect>) — ${TIN_PAR}`,
    transformacao:
      "Σ (área de corte da seção × Δestaca) ao longo de cada eixo. A área de corte é medida entre a linha de terreno e a linha de plataforma de cada seção.",
    escopo:
      "Plataforma por seção — o corpo estradal entre os offsets da plataforma projetada.",
    caveat:
      "Não é o escopo corredor-TIN (volume entre superfícies inteiras, tipicamente várias vezes maior) nem o QTO oficial do Civil 3D — as material lists não viajam no LandXML.",
    abas: ["visao", "resumo-exec", "balanco-massas", "volumes-secao"],
    valorDe: (p) => m3(p.volumes_base.corteTotal),
  },
  {
    chave: "volumes_base.aterroFc",
    rotulo: "Aterro (volume compactado)",
    unidade: "m³",
    origemTipo: "landxml-secao",
    origem: `Seções transversais (<CrossSect>) — ${TIN_PAR}`,
    transformacao:
      "Σ (área de aterro da seção × Δestaca). Volume já compactado (na pista); o fator de empolamento/contração entra depois, no Brückner.",
    escopo: "Plataforma por seção, mesmo escopo do corte total.",
    abas: ["visao", "resumo-exec", "balanco-massas", "volumes-secao"],
    valorDe: (p) => m3(p.volumes_base.aterroFc),
  },
  {
    chave: "volumes_base.pavimento",
    rotulo: "Volume de pavimento",
    unidade: "m³",
    origemTipo: "landxml-secao",
    origem:
      "Seções transversais — faixa entre a plataforma acabada (TOPO) e o subleito (DATUM)",
    transformacao:
      "Σ (área entre TOPO e DATUM × Δestaca). Só existe quando o recorte traz as duas superfícies.",
    abas: ["visao", "balanco-massas"],
    valorDe: (p) => m3(p.volumes_base.pavimento),
  },
  {
    chave: "volumes_base.corte1Cat",
    rotulo: "Corte 1ª categoria (solo)",
    unidade: "m³",
    origemTipo: "calculo",
    origem: "Corte total × percentuais de categoria",
    transformacao:
      "corte 1ª = corte total − (2ª + 3ª). Depende inteiramente de como as categorias foram determinadas (veja `categorias`).",
    abas: ["balanco-massas", "cen-orcamento"],
    valorDe: (p) => m3(p.volumes_base.corte1Cat),
  },
  {
    chave: "volumes_base.corte3Cat",
    rotulo: "Corte 3ª categoria (rocha sã)",
    unidade: "m³",
    origemTipo: "calculo",
    origem: "Corte total × percentual de 3ª categoria",
    transformacao:
      "corte total × pct_3cat. É o item de maior peso unitário no orçamento — confira a base do percentual.",
    abas: ["balanco-massas", "cen-orcamento"],
    valorDe: (p) => m3(p.volumes_base.corte3Cat),
  },
  {
    chave: "volumes_base.jazidaTotal",
    rotulo: "Empréstimo / jazida",
    unidade: "m³",
    origemTipo: "calculo-navegador",
    origem: "Balanço da curva de massas",
    transformacao:
      "Déficit de material do balanço: aterro que não é atendido por corte compensável dentro da distância máxima econômica.",
    aoVivo: true,
    abas: ["visao", "balanco-massas", "cen-jazidas"],
    valorDe: (p) => m3(p.volumes_base.jazidaTotal),
  },
  {
    chave: "volumes_base.bfTotal",
    rotulo: "Bota-fora",
    unidade: "m³",
    origemTipo: "calculo-navegador",
    origem: "Balanço da curva de massas",
    transformacao:
      "Excedente de corte que não encontra aterro compensável; inclui material impróprio quando declarado.",
    aoVivo: true,
    abas: ["visao", "balanco-massas", "cen-botaforas"],
    valorDe: (p) => m3(p.volumes_base.bfTotal),
  },
  {
    chave: "volumes_base.cftBase",
    rotulo: "CFT — camada final de terraplenagem",
    unidade: "m³",
    origemTipo: "manual",
    origem: "Entrada do projetista (ou superfície CFT do corredor, quando existe)",
    transformacao:
      "Quando o recorte não traz a superfície CFT, o volume é digitado no painel de entradas do projeto.",
    abas: ["premissas", "cen-premissas"],
    valorDe: (p) => m3(p.volumes_base.cftBase),
  },
  {
    chave: "volumes_base.soloMole",
    rotulo: "Solo mole a remover",
    unidade: "m³",
    origemTipo: "manual",
    origem: "Sondagens (espessura de solo mole) ou entrada do projetista",
    transformacao:
      "Espessura de solo mole × área de aterro sobre o trecho; sem sondagens projetadas, é entrada manual.",
    abas: ["premissas", "geotecnia"],
    valorDe: (p) => m3(p.volumes_base.soloMole),
  },

  /* — Bins e Brückner — */
  {
    chave: "bins",
    rotulo: "Volumes por segmento (bins)",
    unidade: "m³",
    origemTipo: "calculo",
    origem: "Seções transversais agregadas em segmentos de largura fixa",
    transformacao:
      "As áreas de seção são integradas por trapézios entre seções consecutivas e somadas em bins de largura constante (uma estaca, por padrão).",
    caveat:
      "Lacunas de seção viram quebra de segmento — o pacote emite aviso e a curva de massas é dividida ali.",
    abas: ["bruckner", "volumes-secao", "matriz-dmt"],
    valorDe: (p) =>
      `${fmt(p.bins.length)} bin(s) de ${fmt(p.bins_meta?.largura_m ?? null)} m`,
  },
  {
    chave: "bruckner",
    rotulo: "Curva de massas, momento de transporte e DMT",
    unidade: "m³·km / m",
    origemTipo: "calculo-navegador",
    origem: "Bins de volume + barreiras + parâmetros do cenário",
    transformacao:
      "Curva de massas = soma acumulada de (corte − aterro × fator de empolamento) por bin. A compensação em ondas respeita as barreiras; momento = Σ (volume compensado × distância de transporte); DMT = momento ÷ volume compensado.",
    escopo:
      "Recalculado no navegador a cada mudança de premissa ou cenário — o valor do pacote é só o caso base.",
    aoVivo: true,
    abas: ["visao", "bruckner", "momento", "cen-momento", "matriz-dmt"],
    valorDe: (p) => {
      const t = p.bruckner?.totals as Record<string, number> | undefined;
      if (!t) return null;
      return `momento ${fmt(t.momento_m3km)} m³·km · DMT ${fmt(t.dmt_medio_m)} m`;
    },
  },

  /* — Geometria — */
  {
    chave: "geometria",
    rotulo: "Traçado, perfil longitudinal e seções desenhadas",
    origemTipo: "landxml-secao",
    origem:
      "<Alignment> (traçado), <ProfAlign> (greide) e <CrossSect> (linhas de terreno/plataforma) dos recortes",
    transformacao:
      "As linhas são decimadas e deslocadas por um offset de mundo (E/N) e de cota, para caber no pacote. Cada seção registra o método com que foi obtida — veja 'Método por seção'.",
    caveat:
      "Cotas de <DesignCrossSectSurf> são relativas ao greide; o adaptador as converte para absolutas somando o greide da revisão vigente. Seção desenhada ≠ seção de projeto assinada.",
    abas: ["secoes", "corredor3d", "diagrama-planta"],
    valorDe: (p) => {
      const g = geometriaDe(p);
      if (!g) return null;
      const n = g.eixos.reduce((s, e) => s + (e.secoes?.length ?? 0), 0);
      return `${fmt(n)} seção(ões) em ${g.eixos.length} eixo(s)`;
    },
  },

  /* — Premissas, categorias e custos — */
  {
    chave: "categorias",
    rotulo: "Categorias de escavação (1ª / 2ª / 3ª)",
    unidade: "%",
    origemTipo: "premissa",
    origem:
      "Percentuais default do adaptador, ou evidências (superfície de material / sondagens) quando existem",
    transformacao:
      "Quando `modo = premissa`, aplica percentuais fixos sobre o corte total. Quando há evidência, os percentuais vêm da espessura por categoria das camadas de sondagem ou de superfícies de material.",
    caveat:
      "Categoria é o parâmetro que mais move o orçamento. Em modo premissa, sem evidência, o número é uma hipótese — não um levantamento.",
    abas: ["premissas", "cen-premissas", "balanco-massas"],
    valorDe: (p) =>
      `modo ${p.categorias?.modo ?? "—"} · 2ª ${fmt((p.categorias?.pct_2cat_default ?? 0) * 100, 1)}% · 3ª ${fmt((p.categorias?.pct_3cat_default ?? 0) * 100, 1)}% · ${p.categorias?.evidencias?.length ?? 0} evidência(s)`,
  },
  {
    chave: "premissas_default",
    rotulo: "Premissas de cálculo (fatores, distâncias, produções)",
    origemTipo: "premissa",
    origem: "Defaults do adaptador, editáveis no painel de premissas",
    transformacao:
      "Alimentam o Brückner e o orçamento. Editar cria um cenário — o caso base preserva os defaults.",
    abas: ["premissas", "cen-premissas"],
    valorDe: (p) => `${Object.keys(p.premissas_default ?? {}).length} premissa(s)`,
  },
  {
    chave: "custos",
    rotulo: "Custos unitários dos serviços",
    unidade: "R$/m³",
    origemTipo: "premissa",
    origem: "Tabela de referência (SICRO) carregada pelo adaptador",
    transformacao:
      "Custo do cenário = Σ (volume do serviço × custo unitário) + transporte (momento × custo por m³·km) + royalties.",
    caveat:
      "Sem desoneração, BDI ou reajuste — é custo direto de referência para comparar cenários, não orçamento de licitação.",
    abas: ["orcamento-total", "cen-orcamento", "cen-custo-km"],
    valorDe: (p) => {
      const c = p.custos;
      if (!c) return null;
      const t = c["transporte"];
      return `${Object.keys(c).length} item(ns)${t != null ? ` · transporte ${fmtBRL(t, 2)}/m³·km` : ""}`;
    },
  },
  {
    chave: "recursos",
    rotulo: "Jazidas e bota-foras cadastrados",
    origemTipo: "manual",
    origem: "Cadastro do projetista (nome, DMT, capacidade, royalty)",
    transformacao:
      "Cada ocorrência entra no balanço como origem (jazida) ou destino (bota-fora) com sua distância própria.",
    abas: ["cen-jazidas", "cen-botaforas", "geo-mapa"],
    valorDe: (p) => {
      const r = p.recursos as { jazidas?: unknown[]; botaForas?: unknown[] } | undefined;
      return `${r?.jazidas?.length ?? 0} jazida(s) · ${r?.botaForas?.length ?? 0} bota-fora(s)`;
    },
  },

  /* — Geotecnia — */
  {
    chave: "sondagens",
    rotulo: "Sondagens, camadas, NA e ensaios de laboratório",
    origemTipo: "manual",
    origem:
      "Boletins de sondagem / relatório de investigações, projetados nos eixos pelo importador",
    transformacao:
      "Cada furo é projetado no eixo mais próximo (estaca + offset); as camadas viram categoria de escavação e espessura de solo mole.",
    caveat:
      "Furos desenhados apenas dentro do DWG de perfil não são lidos automaticamente — precisam de extração antes de virar dado do pacote.",
    abas: ["geotecnia", "geo-mapa", "geo-cbr", "geo-resumo"],
    valorDe: (p) => {
      const s = p.sondagens as { sondagens?: unknown[] } | null | undefined;
      const n = Array.isArray(s?.sondagens) ? s.sondagens.length : 0;
      return n ? `${n} furo(s)` : "nenhum furo no pacote";
    },
  },
  {
    chave: "perfil_geologico",
    rotulo: "Perfil geológico (horizontes e estratos)",
    origemTipo: "prancha",
    origem: "DWG do perfil longitudinal — camadas de horizonte geológico",
    transformacao:
      "Os polígonos de horizonte são amostrados ao longo do eixo e cruzados com o perfil de corte para estimar material escavado por categoria.",
    abas: ["geotecnia", "geo-resumo"],
  },

  /* — Drenagem — */
  {
    chave: "drenagem",
    rotulo: "Dispositivos, travessias e bacias de drenagem",
    origemTipo: "prancha",
    origem: "Pranchas de drenagem e hidrologia (DWG/PDF) + eixo georreferenciado",
    transformacao:
      "Os dispositivos são lidos das pranchas e posicionados por estaca/offset no eixo; travessias são classificadas por tipo de bueiro/OAE.",
    caveat:
      "Extração a partir de desenho — confira contra as pranchas antes de quantificar. Faltando pranchas, o cadastro fica parcial.",
    abas: ["dre-visao"],
    valorDe: (p) => {
      const d = p.drenagem as
        | { dispositivos?: unknown[]; resumo?: { extensao_total_m?: number } }
        | null
        | undefined;
      if (!d?.dispositivos) return null;
      return `${fmt(d.dispositivos.length)} dispositivo(s)`;
    },
  },

  /* — Blocos de planejamento (extensões) — */
  {
    chave: "cronograma",
    rotulo: "Cronograma / Gantt e curva físico-financeira",
    origemTipo: "manual",
    origem: "Bloco de extensão `cronograma` do pacote",
    transformacao:
      "Tarefas, dependências e marcos são exibidos como recebidos — o dashboard não sequencia nem calcula caminho crítico.",
    abas: ["cronograma"],
  },
  {
    chave: "produtividades",
    rotulo: "Produtividades de equipe e equipamento",
    origemTipo: "premissa",
    origem: "Bloco de extensão `produtividades` do pacote",
    transformacao: "Alimenta a estimativa de prazo e a análise de simultaneidade.",
    abas: ["prazo", "simultaneidade"],
  },
  {
    chave: "praticabilidade",
    rotulo: "Praticabilidade / dias trabalháveis",
    origemTipo: "premissa",
    origem: "Bloco de extensão `praticabilidade` do pacote",
    transformacao: "Converte produção teórica em prazo de calendário.",
    abas: ["prazo"],
  },
  {
    chave: "transferencias_equipamentos",
    rotulo: "Transferências de equipamento entre frentes",
    origemTipo: "premissa",
    origem: "Bloco de extensão `transferencias_equipamentos` do pacote",
    transformacao: "Penaliza o prazo com o tempo de mobilização entre frentes.",
    abas: ["prazo", "simultaneidade"],
  },
  {
    chave: "tempo_caminho",
    rotulo: "Tempo × caminho de transporte",
    origemTipo: "manual",
    origem: "Bloco de extensão `tempo_caminho` do pacote",
    transformacao: "Séries origem→destino exibidas como recebidas.",
    abas: ["tempo-caminho"],
  },
  {
    chave: "otimizacoes",
    rotulo: "Oportunidades de otimização",
    origemTipo: "manual",
    origem: "Bloco de extensão `otimizacoes` do pacote",
    transformacao:
      "Cards de oportunidade (com e sem mudança de geometria) exibidos como recebidos; a economia declarada não é recalculada pelo dashboard.",
    abas: ["otim-sem-geo", "otim-com-geo"],
  },
  {
    chave: "analise_simultaneidade",
    rotulo: "Simultaneidade de frentes",
    origemTipo: "manual",
    origem: "Bloco de extensão `analise_simultaneidade` do pacote",
    transformacao: "Janelas de frente e pico de recurso exibidos como recebidos.",
    abas: ["simultaneidade"],
  },
];

const POR_CHAVE = new Map(CATALOGO.map((c) => [c.chave, c]));

export function campoDoCatalogo(chave: string): CampoLinhagem | null {
  return (
    POR_CHAVE.get(chave) ?? POR_CHAVE.get(chave.split(".")[0]) ?? null
  );
}

/* ── Gerador e arquivos-fonte ─────────────────────────────── */

export interface ArquivoFonte {
  filename: string;
  size_bytes: number;
}

export interface FontesPacote {
  tool: string | null;
  mode: string | null;
  geradoEm: string;
  schema: string;
  schemaVersion: number;
  arquivos: ArquivoFonte[];
}

export function fontesDoPacote(pacote: MtpPacote | null): FontesPacote {
  const g = pacote?.generator;
  return {
    tool: g?.tool ?? null,
    mode: g?.mode ?? null,
    geradoEm: pacote?.generated_at ?? "",
    schema: pacote?.schema ?? "",
    schemaVersion: pacote?.schema_version ?? 0,
    arquivos: Array.isArray(g?.source_files) ? g.source_files : [],
  };
}

/** Etapa da cadeia de origem (o caminho do dado até a tela). */
export interface EtapaCadeia {
  rotulo: string;
  detalhe: string;
}

export function cadeiaDeOrigem(pacote: MtpPacote | null): EtapaCadeia[] {
  const f = fontesDoPacote(pacote);
  const n = f.arquivos.length;
  return [
    {
      rotulo: "Projeto no CAD",
      detalhe:
        "Corredores, superfícies e greides modelados no Civil 3D; pranchas em DWG/PDF.",
    },
    {
      rotulo: "Exportação LandXML",
      detalhe: `Alinhamentos, superfícies, perfis e seções transversais${
        n ? ` — ${n} arquivo(s) declarado(s) no pacote` : ""
      }.`,
    },
    {
      rotulo: "Adaptador Manta",
      detalhe: [
        f.tool ? `ferramenta ${f.tool}` : null,
        f.mode ? `modo ${f.mode}` : null,
        "converte cotas relativas em absolutas, integra áreas de seção e agrega em bins",
      ]
        .filter(Boolean)
        .join(" · "),
    },
    {
      rotulo: "Pacote .mtp.json",
      detalhe: `${f.schema || "manta-terraplenagem-package"} v${
        f.schemaVersion || "?"
      } — o estado congelado que o dashboard carrega.`,
    },
    {
      rotulo: "Cálculo no navegador",
      detalhe:
        "Curva de massas, compensação, momento, DMT e orçamento são recalculados ao vivo a cada premissa ou cenário.",
    },
  ];
}

/* ── Método por seção (a rastreabilidade mais fina) ───────── */

/**
 * Métodos de obtenção da seção (`MtpGeoSecao.fonte`, o `source_mode` do
 * adaptador). Os rótulos curtos espelham `rotuloFonte` da aba Seções; aqui
 * cada um ganha a explicação de COMO a linha foi obtida.
 */
export const METODO_ROTULO: Record<string, string> = {
  terrain_datum: "seção absoluta (TN + DATUM)",
  datum_tin_cut: "corte na TIN do DATUM",
  talude_inferred_reconstructed: "reconstruída (greide + links)",
  talude_inferred: "talude inferido",
  material_polygons: "polígonos de material",
};

export const METODO_EXPLICACAO: Record<string, string> = {
  terrain_datum:
    "As cotas de terreno e de plataforma vieram gravadas na própria seção do LandXML, em valor absoluto. É a fonte da verdade — nada foi reconstruído.",
  datum_tin_cut:
    "A seção não trazia snapshot do DATUM; a linha de plataforma foi recortada da superfície TIN de projeto na estaca. Fiel à TIN exportada.",
  talude_inferred_reconstructed:
    "Sem snapshot e sem TIN utilizável: a plataforma foi reconstruída somando as cotas relativas dos links de projeto ao greide da revisão vigente, e os taludes foram inferidos até encontrar o terreno.",
  talude_inferred:
    "Os taludes foram inferidos por inclinação até interceptar o terreno — a geometria de bordo é estimada, não desenhada.",
  material_polygons:
    "As áreas vieram dos polígonos de material list do corredor, não da interseção de linhas de seção.",
};

/** Confiança relativa do método (menor = mais fiel à fonte). */
export const METODO_ORDEM: Record<string, number> = {
  terrain_datum: 0,
  material_polygons: 1,
  datum_tin_cut: 2,
  talude_inferred_reconstructed: 3,
  talude_inferred: 4,
};

/** O `fonte` pode vir composto (`terrain_datum+synthTN`). */
function baseDoMetodo(fonte: string): string {
  return fonte.split("+")[0];
}

export function metodoRotulo(fonte: string): string {
  const base = baseDoMetodo(fonte);
  const nome = METODO_ROTULO[base] ?? base ?? "—";
  return fonte.includes("synthTN") ? `${nome} · terreno do TIN` : nome;
}

export function metodoExplicacao(fonte: string): string {
  const base = baseDoMetodo(fonte);
  const exp = METODO_EXPLICACAO[base] ?? "Método registrado pelo adaptador.";
  return fonte.includes("synthTN")
    ? `${exp} A linha de terreno foi amostrada da TIN de levantamento (não vinha na seção).`
    : exp;
}

export function metodoOrdem(fonte: string): number {
  return METODO_ORDEM[baseDoMetodo(fonte)] ?? 9;
}

export interface MetodoFaixa {
  fonte: string;
  n: number;
  pct: number;
  faixas: string[];
}

export interface MetodoEixo {
  eixoId: string;
  total: number;
  porFonte: MetodoFaixa[];
}

/** Bloco `geometria` tipado (null quando ausente). */
export function geometriaDe(pacote: MtpPacote | null): MtpGeometria | null {
  const g = pacote?.geometria;
  if (!g || !Array.isArray(g.eixos)) return null;
  return g;
}

function rotuloFaixa(a: number, b: number): string {
  return a === b ? staToKmLabel(a) : `${staToKmLabel(a)} → ${staToKmLabel(b)}`;
}

/** Agrupa estações contíguas (gap > 1,5 × passo abre nova faixa). */
export function faixasContiguas(
  stas: number[],
  passo: number,
  max = 6,
): string[] {
  if (stas.length === 0) return [];
  const ord = [...stas].sort((a, b) => a - b);
  const tol = Math.max((passo || 20) * 1.5, 1);
  const out: string[] = [];
  let ini = ord[0];
  let prev = ord[0];
  for (let i = 1; i < ord.length; i++) {
    if (ord[i] - prev > tol) {
      out.push(rotuloFaixa(ini, prev));
      ini = ord[i];
    }
    prev = ord[i];
  }
  out.push(rotuloFaixa(ini, prev));
  if (out.length > max) {
    return [...out.slice(0, max), `+${out.length - max} faixa(s)`];
  }
  return out;
}

function metodosDeEixo(e: MtpGeoEixo): MetodoEixo {
  const secoes = Array.isArray(e.secoes) ? e.secoes : [];
  const grupos = new Map<string, number[]>();
  for (const s of secoes) {
    const f = s.fonte || "desconhecido";
    const arr = grupos.get(f);
    if (arr) arr.push(s.sta_m);
    else grupos.set(f, [s.sta_m]);
  }
  const total = secoes.length;
  const porFonte = [...grupos.entries()]
    .map(([fonte, stas]) => ({
      fonte,
      n: stas.length,
      pct: total ? (stas.length / total) * 100 : 0,
      faixas: faixasContiguas(stas, e.secoes_passo_m),
    }))
    .sort((a, b) => metodoOrdem(a.fonte) - metodoOrdem(b.fonte) || b.n - a.n);
  return { eixoId: e.eixo_id, total, porFonte };
}

export function metodosPorEixo(pacote: MtpPacote | null): MetodoEixo[] {
  const g = geometriaDe(pacote);
  if (!g) return [];
  return g.eixos.map(metodosDeEixo).filter((m) => m.total > 0);
}

/* ── Avisos relacionados a uma chave ──────────────────────── */

/** Termos que ligam um aviso do pacote a um bloco de dado. */
const ALIAS_AVISO: Record<string, string[]> = {
  eixos: ["eixo", "alinhamento", "estaqueamento"],
  bins: ["bin", "segmento", "lacuna", "gap"],
  bruckner: ["brückner", "bruckner", "curva de massas", "barreira", "momento"],
  barreiras: ["barreira", "oae"],
  geometria: ["seç", "greide", "reconstru", "tin", "datum", "cota"],
  categorias: ["categoria", "rocha", "1ª", "2ª", "3ª"],
  custos: ["custo", "sicro", "preço"],
  sondagens: ["sondagem", "furo", "spt", "geotecn"],
  drenagem: ["drenagem", "dispositivo", "bueiro", "travessia", "bacia"],
  volumes_base: ["volume", "corte", "aterro"],
  extensoes: ["extensão", "extensao"],
};

export function avisosRelacionados(
  pacote: MtpPacote | null,
  chave: string,
): string[] {
  if (!pacote) return [];
  const bloco = chave.split(".")[0];
  const termos = [bloco.toLowerCase(), ...(ALIAS_AVISO[bloco] ?? [])];
  const todos = [
    ...(pacote.warnings ?? []),
    ...(bloco === "geometria" ? (geometriaDe(pacote)?.warnings ?? []) : []),
  ];
  return todos.filter((w) => {
    const t = w.toLowerCase();
    return termos.some((termo) => t.includes(termo));
  });
}

/* ── Linhagem resolvida de uma chave ──────────────────────── */

export interface LinhagemResolvida {
  chave: string;
  campo: CampoLinhagem | null;
  prov: Provenance;
  /**
   * "ausente" quando o pacote reserva a chave de proveniência mas NÃO traz o
   * bloco de dado. É o caso das chaves `example`/`manual` reservadas pelo
   * adaptador: sem isso, o chip anuncia "dados de exemplo" ao lado de um painel
   * vazio, e quem lê acha que há número de demonstração na tela.
   */
  situacao: "presente" | "ausente";
  /**
   * true quando o pacote não declara proveniência para a chave nem para o
   * bloco — a classe acima foi deduzida do catálogo, não afirmada pelo pacote.
   */
  provInferida: boolean;
  /** Arquivos-fonte declarados no pacote (compartilhados por todos os blocos). */
  arquivos: ArquivoFonte[];
  avisos: string[];
  /** Valor atual formatado, quando o catálogo sabe extraí-lo. */
  valor: string | null;
}

/** true quando o pacote declara proveniência para a chave ou para o bloco. */
export function provDeclarada(pacote: MtpPacote | null, chave: string): boolean {
  const map = pacote?.provenance ?? {};
  return chave in map || chave.split(".")[0] in map;
}

export function linhagemDe(
  pacote: MtpPacote | null,
  chave: string,
): LinhagemResolvida {
  const campo = campoDoCatalogo(chave);
  let valor: string | null = null;
  if (campo?.valorDe && pacote) {
    try {
      valor = campo.valorDe(pacote);
    } catch {
      valor = null;
    }
  }
  const bloco = chave.split(".")[0];
  const declarada = provDeclarada(pacote, chave);
  return {
    chave,
    campo,
    prov: declarada
      ? provenanceDe(pacote, chave)
      : (campo ? CLASSE_POR_ORIGEM[campo.origemTipo] : "manual"),
    provInferida: !declarada,
    situacao: !chave || blocoPresente(pacote, bloco) ? "presente" : "ausente",
    arquivos: fontesDoPacote(pacote).arquivos,
    avisos: avisosRelacionados(pacote, chave),
    valor,
  };
}

/**
 * Blocos que o pacote declara como dados de exemplo E realmente traz — ou seja,
 * número de demonstração visível na tela. Só estes merecem aviso destacado.
 */
export function exemplosNaTela(pacote: MtpPacote | null): string[] {
  return blocosDeExemplo(pacote).filter((k) =>
    blocoPresente(pacote, k.split(".")[0]),
  );
}

/* ── Cobertura: quais campos este pacote realmente tem ────── */

/** Vazio = null, array/string vazios, ou objeto cujos valores são todos vazios. */
function naoVazio(v: unknown, prof = 0): boolean {
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "string") return v.length > 0;
  if (typeof v === "object") {
    const vals = Object.values(v as object);
    if (vals.length === 0) return false;
    if (prof >= 2) return true;
    return vals.some((x) => naoVazio(x, prof + 1));
  }
  return true;
}

/** true quando o bloco existe no pacote e traz conteúdo de fato. */
export function blocoPresente(pacote: MtpPacote | null, bloco: string): boolean {
  if (!pacote) return false;
  return naoVazio((pacote as unknown as Record<string, unknown>)[bloco]);
}

/**
 * Linhas do catálogo aplicáveis ao pacote carregado: o bloco existe, ou o
 * pacote declara proveniência para ele (mesmo ausente, para expor a lacuna).
 */
export function camposDoPacote(pacote: MtpPacote | null): LinhagemResolvida[] {
  if (!pacote) return [];
  const prov = pacote.provenance ?? {};
  return CATALOGO.filter((c) => {
    const bloco = c.chave.split(".")[0];
    return c.chave in prov || bloco in prov || blocoPresente(pacote, bloco);
  }).map((c) => linhagemDe(pacote, c.chave));
}

/** Chaves de proveniência marcadas como dados de exemplo/demonstração. */
export function blocosDeExemplo(pacote: MtpPacote | null): string[] {
  const prov = pacote?.provenance ?? {};
  return Object.entries(prov)
    .filter(([, p]) => p === "example")
    .map(([k]) => k);
}

/** Contagem de chaves por classe de proveniência. */
export function contagemProveniencia(
  pacote: MtpPacote | null,
): Partial<Record<Provenance, number>> {
  const c: Partial<Record<Provenance, number>> = {};
  for (const p of Object.values(pacote?.provenance ?? {})) {
    c[p] = (c[p] ?? 0) + 1;
  }
  return c;
}

/* ── Export do catálogo (auditoria fora do dashboard) ─────── */

const CSV_COLS = [
  "campo",
  "rotulo",
  "valor_atual",
  "proveniencia",
  "proveniencia_inferida",
  "bloco_no_pacote",
  "origem_tipo",
  "origem",
  "transformacao",
  "escopo",
  "ressalva",
  "abas",
] as const;

function csvCell(v: string): string {
  return `"${v.replace(/"/g, '""')}"`;
}

export function catalogoParaCsv(linhas: LinhagemResolvida[]): string {
  const head = CSV_COLS.join(";");
  const rows = linhas.map((l) =>
    [
      l.chave,
      l.campo?.rotulo ?? "",
      l.valor ?? "",
      l.prov,
      l.provInferida ? "sim" : "nao",
      l.situacao === "presente" ? "sim" : "nao",
      l.campo ? ORIGEM_ROTULO[l.campo.origemTipo] : "",
      l.campo?.origem ?? "",
      l.campo?.transformacao ?? "",
      l.campo?.escopo ?? "",
      l.campo?.caveat ?? "",
      (l.campo?.abas ?? []).join(", "),
    ]
      .map((c) => csvCell(String(c)))
      .join(";"),
  );
  return [head, ...rows].join("\r\n");
}

export function catalogoParaMarkdown(
  linhas: LinhagemResolvida[],
  titulo: string,
): string {
  const out: string[] = [`# Rastreabilidade de dados — ${titulo}`, ""];
  for (const l of linhas) {
    out.push(`## ${l.campo?.rotulo ?? l.chave}`);
    out.push("");
    out.push(`- **Campo:** \`${l.chave}\``);
    if (l.valor) out.push(`- **Valor atual:** ${l.valor}`);
    out.push(
      `- **Proveniência:** ${l.prov}${
        l.provInferida ? " (inferida do catálogo — o pacote não declara)" : ""
      }`,
    );
    if (l.situacao === "ausente") {
      out.push("- **Situação:** bloco reservado no provenance, ausente do pacote");
    }
    if (l.campo) {
      out.push(
        `- **Origem:** ${ORIGEM_ROTULO[l.campo.origemTipo]} — ${l.campo.origem}`,
      );
      out.push(`- **Transformação:** ${l.campo.transformacao}`);
      if (l.campo.escopo) out.push(`- **Escopo:** ${l.campo.escopo}`);
      if (l.campo.caveat) out.push(`- **Ressalva:** ${l.campo.caveat}`);
      out.push(`- **Onde aparece:** ${l.campo.abas.join(", ")}`);
    }
    if (l.avisos.length) {
      out.push(`- **Avisos:** ${l.avisos.join(" · ")}`);
    }
    out.push("");
  }
  return out.join("\n");
}
