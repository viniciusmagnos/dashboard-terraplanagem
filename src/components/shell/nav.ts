import {
  LayoutDashboard,
  Database,
  GitCompare,
  Lightbulb,
  Mountain,
  Droplets,
  FileText,
  type LucideIcon,
} from "lucide-react";

/**
 * Estrutura de navegação = casca visual do dashboard de referência (Motiva):
 * top-nav horizontal (6 abas) + coluna vertical de sub-abas colorida por seção.
 * Cada seção hospeda um ou mais painéis funcionais do Manta Hub (landxml).
 * Paleta de acentos em tons de terra (identidade Manta).
 */

export type TopTabId =
  | "dashboard"
  | "dados"
  | "cenarios"
  | "otimizacoes"
  | "geotecnia"
  | "drenagem"
  | "relatorio";

export interface SubTab {
  id: string;
  label: string;
  /** Rótulo de grupo (divisória na coluna de sub-abas). */
  grupo?: string;
  /** Marca visual de origem — "ia" = sub-aba criada pelo assistente. */
  badge?: "ia";
}

export interface TopTab {
  id: TopTabId;
  label: string;
  icon: LucideIcon;
  /** Cor de acento da seção (tom de terra Manta). */
  accent: string;
  subs: SubTab[];
}

/** Shape mínimo de uma aba dinâmica (espelha AbaDinamica da Dashboard Spec —
 * estrutural de propósito para não acoplar o nav ao módulo do spec). */
export interface AbaDinamicaNav {
  id: string;
  titulo: string;
  top: TopTabId;
  grupo: string;
}

/**
 * NAV estático + sub-abas dinâmicas criadas pelo assistente, anexadas ao fim
 * da seção `top` correspondente sob o grupo delas (default "Análises IA").
 * As dinâmicas ganham badge "ia" (chip na coluna de sub-abas).
 */
export function navComDinamicas(abas: AbaDinamicaNav[]): TopTab[] {
  if (!abas.length) return NAV;
  return NAV.map((t) => {
    const dinamicas = abas.filter((a) => a.top === t.id);
    if (!dinamicas.length) return t;
    return {
      ...t,
      subs: [
        ...t.subs,
        ...dinamicas.map((a) => ({
          id: a.id,
          label: a.titulo,
          grupo: a.grupo,
          badge: "ia" as const,
        })),
      ],
    };
  });
}

export const NAV: TopTab[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    accent: "#C8601F",
    subs: [
      { id: "visao", label: "Visão consolidada", grupo: "Visão geral" },
      { id: "premissas", label: "Premissas", grupo: "Visão geral" },
      { id: "dash-rodovias", label: "Rodovias", grupo: "Visão geral" },
      { id: "resumo-exec", label: "Resumo executivo", grupo: "Visão geral" },
      { id: "bruckner", label: "Brückner e DMT", grupo: "Análise" },
      { id: "matriz-dmt", label: "Análise (Matriz DMT)", grupo: "Análise" },
      { id: "quadro-od", label: "Quadro O/D", grupo: "Análise" },
      { id: "momento", label: "Momento transporte", grupo: "Análise" },
      { id: "balanco-massas", label: "Balanço de massas", grupo: "Análise" },
      { id: "dme", label: "Distância máx. econômica", grupo: "Análise" },
      { id: "orcamento-total", label: "Orçamento total", grupo: "Análise" },
      { id: "diagrama-planta", label: "Diagrama em planta", grupo: "Análise" },
      { id: "cronograma", label: "Cronograma Gantt", grupo: "Planejamento" },
      { id: "simultaneidade", label: "Análise simultaneidade", grupo: "Planejamento" },
      { id: "tempo-caminho", label: "Tempo × caminho", grupo: "Planejamento" },
      { id: "validacao-dados", label: "Validação de dados", grupo: "Qualidade" },
      { id: "validacao-fisica", label: "Validação exec. física", grupo: "Qualidade" },
    ],
  },
  {
    id: "dados",
    label: "Dados",
    icon: Database,
    accent: "#8B5E34",
    subs: [
      { id: "dados-rodovias", label: "Rodovias" },
      { id: "volumes-secao", label: "Volumes por seção" },
      { id: "secoes", label: "Seções transversais" },
      { id: "corredor3d", label: "3D do corredor" },
      { id: "banco-dados", label: "Banco de dados" },
      { id: "fontes-xml", label: "LandXML bruto (IA)" },
    ],
  },
  {
    id: "cenarios",
    label: "Cenários",
    icon: GitCompare,
    accent: "#4E7C59",
    subs: [
      { id: "cen-visao", label: "Visão", grupo: "Cenário ativo" },
      { id: "cen-premissas", label: "Premissas", grupo: "Cenário ativo" },
      { id: "cen-quadro-od", label: "Quadro O/D", grupo: "Cenário ativo" },
      { id: "cen-jazidas", label: "Jazidas", grupo: "Cenário ativo" },
      { id: "cen-botaforas", label: "Bota-foras", grupo: "Cenário ativo" },
      { id: "cen-momento", label: "Momento transporte", grupo: "Cenário ativo" },
      { id: "cen-orcamento", label: "Orçamento", grupo: "Cenário ativo" },
      { id: "cen-custo-km", label: "Custo por km", grupo: "Cenário ativo" },
      { id: "cen-diagrama", label: "Diagrama planta", grupo: "Cenário ativo" },
      { id: "cen-comparativo", label: "Resumo comparativo", grupo: "Comparação" },
    ],
  },
  {
    id: "otimizacoes",
    label: "Otimizações",
    icon: Lightbulb,
    accent: "#B07D22",
    subs: [
      { id: "sim-real", label: "Simulador (dados reais)" },
      { id: "otim-sem-geo", label: "Sem mudança de geometria" },
      { id: "otim-com-geo", label: "Com mudança de geometria" },
      { id: "simulacoes", label: "Simulações" },
      { id: "prazo", label: "Prazo" },
    ],
  },
  {
    id: "geotecnia",
    label: "Geotecnia",
    icon: Mountain,
    accent: "#7A5230",
    subs: [
      { id: "geotecnia", label: "Sondagens & perfil" },
      { id: "geo-mapa", label: "Mapa interativo" },
      { id: "geo-cbr", label: "Ensaios CBR" },
      { id: "geo-resumo", label: "Resumo por rodovia" },
      { id: "importar-sondagens", label: "Importar sondagens" },
    ],
  },
  {
    id: "drenagem",
    label: "Drenagem",
    icon: Droplets,
    accent: "#3F6E7D",
    subs: [{ id: "dre-visao", label: "Dispositivos & travessias" }],
  },
  {
    id: "relatorio",
    label: "Relatório",
    icon: FileText,
    accent: "#9A5B2A",
    subs: [
      { id: "rel-central", label: "Central de exportação" },
      { id: "rel-completo", label: "Relatório completo" },
      { id: "rel-pacote", label: "Exportar pacote" },
      { id: "rastreabilidade", label: "Rastreabilidade" },
    ],
  },
];

/** Encontra a seção que contém uma sub-aba (para navegação cruzada). */
export function secaoDaSub(subId: string): TopTabId | null {
  for (const t of NAV) {
    if (t.subs.some((s) => s.id === subId)) return t.id;
  }
  return null;
}
