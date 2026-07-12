// APP-LOCAL — não adicionar ao sync-from-hub.
//
// "Dashboard Spec" — a spec declarativa do layout dinâmico que o assistente
// IA muta via tools dashboard_* (persistida em estudos.layout_json no hub,
// com layout_rev próprio). Este arquivo é a FONTE DA VERDADE do shape fino
// no cliente; o backend valida só envelope+limites (forward-compat), então o
// parser aqui é RESILIENTE: item malformado ou de tipo desconhecido vira
// BlocoInvalido (card de aviso), nunca crash.
import type { TopTabId } from "../components/shell/nav";

export const SLOTS = ["visao.topo", "visao.rodape", "cen-visao.rodape"] as const;
export type SlotId = (typeof SLOTS)[number];

export type LocalBloco =
  | { tipo: "aba"; abaId: string }
  | { tipo: "slot"; slot: SlotId };

/* ── Data binding ──────────────────────────────────────────── */

export interface BrucknerParamsBinding {
  fillFactor?: number;
  baseline?: "start" | "median";
  barreirasAtivas?: number[];
  barreirasExtras?: { sta_m: number; nome?: string }[];
}

export type Binding =
  | {
      fonte: "bruckner.curve";
      /** "ativo" (default) | "caso-base" | id de cenário. */
      cenario?: string;
      /** Hipótese computada client-side por cima do cenário base. */
      params?: BrucknerParamsBinding;
    }
  | { fonte: "computado"; cenario?: string; path: string }
  | { fonte: "pacote"; path: string }
  | { fonte: "entradas"; path: string };

/** Dado inline (o agente computa e embute) OU binding vivo (acompanha o
 * estudo — re-resolve quando cenário/entradas mudam). */
export type Dado<T> = { inline: T } | { binding: Binding };

/* ── Blocos ────────────────────────────────────────────────── */

export type FormatoNumero = "int" | "moeda" | "m3" | "m3km" | "pct" | "km" | "m";

export interface BlocoBase {
  id: string;
  local: LocalBloco;
  titulo?: string;
  subtitulo?: string;
  /** Colunas ocupadas no grid de 4 (default 1; kpi) / 2 (demais). */
  span?: 1 | 2 | 3 | 4;
  nota?: string;
  criadoPor?: string;
  criadoEm?: string;
}

export interface BlocoKpi extends BlocoBase {
  tipo: "kpi";
  valor: Dado<number>;
  formato?: FormatoNumero;
  sufixo?: string;
  deltaPct?: number | null;
}

export interface SerieSpec {
  id: string;
  nome?: string;
  cor?: string;
  tracejada?: boolean;
  /** Pares [x, y]. Para curvas Brückner, x em METROS de estação. */
  dados: Dado<[number, number][]>;
}

export interface BlocoChart extends BlocoBase {
  tipo: "chart";
  variante?: "line" | "area" | "bar";
  series: SerieSpec[];
  eixoX?: { label?: string; emKm?: boolean };
  eixoY?: { label?: string; formato?: FormatoNumero };
  refLines?: { x?: number; y?: number; label?: string; cor?: string }[];
  altura?: number;
}

export interface BlocoTable extends BlocoBase {
  tipo: "table";
  colunas: { key: string; label: string; formato?: FormatoNumero; alinhamento?: "left" | "right" }[];
  linhas: Record<string, string | number | null>[];
}

export interface BlocoMarkdown extends BlocoBase {
  tipo: "markdown";
  corpo: string;
}

export interface BlocoPie extends BlocoBase {
  tipo: "pie";
  fatias: { nome: string; valor: number; cor?: string }[];
  donut?: boolean;
}

export type Bloco = BlocoKpi | BlocoChart | BlocoTable | BlocoMarkdown | BlocoPie;

/** Item que o parser não reconheceu — renderizado como card de aviso. */
export interface BlocoInvalido {
  id: string;
  local: LocalBloco;
  titulo?: string;
  motivo: string;
  tipoOriginal?: string;
}

export interface AbaDinamica {
  id: string; // prefixo reservado "ia-"
  titulo: string;
  top: TopTabId;
  grupo: string;
}

export interface OverlaySerie extends SerieSpec {
  /** Gráfico nomeado alvo (registro em dashboard-graficos.ts). */
  grafico: string;
}

export interface DashboardSpec {
  v: 1;
  abas: AbaDinamica[];
  blocos: (Bloco | BlocoInvalido)[];
  overlays: OverlaySerie[];
}

export function especVazia(): DashboardSpec {
  return { v: 1, abas: [], blocos: [], overlays: [] };
}

export function isBlocoInvalido(b: Bloco | BlocoInvalido): b is BlocoInvalido {
  return (b as BlocoInvalido).motivo !== undefined;
}

/* ── Parser resiliente ─────────────────────────────────────── */

const TOPS: TopTabId[] = ["dashboard", "dados", "cenarios", "otimizacoes", "geotecnia", "relatorio"];
const TIPOS_CONHECIDOS = new Set(["kpi", "chart", "table", "markdown", "pie"]);

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v : undefined;
}

function parseLocal(raw: unknown): LocalBloco | null {
  if (!raw || typeof raw !== "object") return null;
  const l = raw as Record<string, unknown>;
  if (l.tipo === "aba" && typeof l.abaId === "string") return { tipo: "aba", abaId: l.abaId };
  if (l.tipo === "slot" && (SLOTS as readonly string[]).includes(String(l.slot))) {
    return { tipo: "slot", slot: l.slot as SlotId };
  }
  return null;
}

function parseBloco(raw: unknown, abasIds: Set<string>): Bloco | BlocoInvalido | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  const id = str(b.id);
  if (!id) return null; // sem id não há como referenciar — descarta
  const local = parseLocal(b.local);
  if (!local) {
    return { id, local: { tipo: "slot", slot: "visao.rodape" }, titulo: str(b.titulo), motivo: "posição (local) inválida" };
  }
  if (local.tipo === "aba" && !abasIds.has(local.abaId)) {
    return { id, local, titulo: str(b.titulo), motivo: `aba "${local.abaId}" não existe mais` };
  }
  const tipo = str(b.tipo) ?? "";
  if (!TIPOS_CONHECIDOS.has(tipo)) {
    return {
      id,
      local,
      titulo: str(b.titulo),
      tipoOriginal: tipo,
      motivo: `tipo de bloco "${tipo}" desconhecido — criado por uma versão mais nova? Atualize o dashboard.`,
    };
  }
  // Shape fino é validado pelos componentes (defensivos) — aqui só o envelope.
  return b as unknown as Bloco;
}

/** Normaliza o JSON vindo do servidor num DashboardSpec seguro. */
export function parseDashboardSpec(raw: unknown): DashboardSpec {
  if (!raw || typeof raw !== "object") return especVazia();
  const s = raw as Record<string, unknown>;

  const abas: AbaDinamica[] = [];
  for (const a of Array.isArray(s.abas) ? s.abas : []) {
    if (!a || typeof a !== "object") continue;
    const aa = a as Record<string, unknown>;
    const id = str(aa.id);
    const titulo = str(aa.titulo);
    if (!id || !titulo || !id.startsWith("ia-")) continue;
    const top = TOPS.includes(aa.top as TopTabId) ? (aa.top as TopTabId) : "dashboard";
    abas.push({ id, titulo, top, grupo: str(aa.grupo) ?? "Análises IA" });
  }
  const abasIds = new Set(abas.map((a) => a.id));

  const blocos: (Bloco | BlocoInvalido)[] = [];
  for (const b of Array.isArray(s.blocos) ? s.blocos : []) {
    const parsed = parseBloco(b, abasIds);
    if (parsed) blocos.push(parsed);
  }

  const overlays: OverlaySerie[] = [];
  for (const o of Array.isArray(s.overlays) ? s.overlays : []) {
    if (!o || typeof o !== "object") continue;
    const oo = o as Record<string, unknown>;
    const id = str(oo.id);
    const grafico = str(oo.grafico);
    if (!id || !grafico || !oo.dados || typeof oo.dados !== "object") continue;
    overlays.push({
      id,
      grafico,
      nome: str(oo.nome),
      cor: str(oo.cor),
      tracejada: typeof oo.tracejada === "boolean" ? oo.tracejada : undefined,
      dados: oo.dados as Dado<[number, number][]>,
    });
  }

  return { v: 1, abas, blocos, overlays };
}
