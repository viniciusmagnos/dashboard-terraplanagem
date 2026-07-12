// =====================================================
// Blocos OPCIONAIS de extensão do pacote .mtp.json.
//
// O `.mtp.json` (manta-terraplenagem-package) é validado por
// `validarPacote` em ./mtp.ts, que preserva TODAS as chaves extras. Estes
// blocos viajam DENTRO do mesmo pacote e alimentam as abas que ainda não têm
// fonte de dado no core do Manta Hub (Cronograma/Gantt, Tempo × Caminho,
// Otimizações, Simultaneidade) + os recursos (jazidas/bota-foras).
//
// Nomes de bloco alinhados aos reservados no `provenance` do pacote
// (cronograma, produtividades, praticabilidade, transferencias_equipamentos)
// para que o askcad/Manta Hub possa emiti-los no futuro sem renomear nada.
//
// IMPORTANTE: mtp.ts é VENDORADO (sync-from-hub o sobrescreve). Por isso a
// tipagem e os helpers destes blocos vivem AQUI, app-local, e leem o pacote
// por cast frouxo (mesma técnica que mtp.ts usa em `geotecniaDe`).
// =====================================================

import type { MtpPacote } from "./mtp";

/** Lê uma chave arbitrária do pacote sem depender do tipo vendorado. */
function bloco<T>(pacote: MtpPacote | null, chave: string): T | undefined {
  return (pacote as unknown as Record<string, T | undefined> | null)?.[chave];
}

/* ── cronograma (Gantt + variantes PER físico-financeiras) ──── */

export interface CronoTarefa {
  id: string;
  nome: string;
  /** Frente/lote/serviço — agrupa as barras. */
  grupo?: string;
  /** Offset em dias a partir de t0. */
  inicio_dia: number;
  duracao_dias: number;
  /** 0–100. */
  progresso_pct?: number;
  /** ids de tarefas predecessoras. */
  dependencias?: string[];
  marco?: boolean;
  cor?: string;
}

export interface CronoCurvaPonto {
  dia: number;
  fisico_pct: number;
  financeiro_rs: number;
}

export interface CronoVariante {
  id: string;
  nome: string;
  tarefas: CronoTarefa[];
  curva_fisico_financeira?: CronoCurvaPonto[];
}

export interface MtpCronograma {
  versao: number;
  /** Data-âncora ISO do dia 0 (opcional; só rótulos). */
  t0?: string;
  tarefas: CronoTarefa[];
  /** Cenários PER (Cronograma PER Completo / Interativo). */
  variantes?: CronoVariante[];
  marcos?: { dia: number; nome: string }[];
}

export function cronogramaDe(pacote: MtpPacote | null): MtpCronograma | null {
  const c = bloco<MtpCronograma>(pacote, "cronograma");
  if (!c || !Array.isArray(c.tarefas) || c.tarefas.length === 0) return null;
  return c;
}

/* ── tempo_caminho (Tempo × Caminho / distância) ────────────── */

export interface TempoCaminhoPonto {
  caminho_km: number;
  tempo_min: number;
}

export interface TempoCaminhoSerie {
  rotulo: string;
  origem?: string;
  destino?: string;
  cor?: string;
  pontos: TempoCaminhoPonto[];
}

export interface MtpTempoCaminho {
  versao: number;
  eixo_x?: string;
  eixo_y?: string;
  series: TempoCaminhoSerie[];
}

export function tempoCaminhoDe(pacote: MtpPacote | null): MtpTempoCaminho | null {
  const t = bloco<MtpTempoCaminho>(pacote, "tempo_caminho");
  if (!t || !Array.isArray(t.series) || t.series.length === 0) return null;
  return t;
}

/* ── otimizacoes (sem/com mudança de geometria) ─────────────── */

export interface OtimCard {
  id: string;
  titulo: string;
  descricao?: string;
  economia_rs?: number;
  economia_pct?: number;
  delta_momento_m3km?: number;
  delta_prazo_meses?: number;
  complexidade?: "baixa" | "media" | "alta" | string;
  status?: string;
  premissa?: string;
}

export interface MtpOtimizacoes {
  versao: number;
  sem_geometria: OtimCard[];
  com_geometria: OtimCard[];
}

export function otimizacoesDe(pacote: MtpPacote | null): MtpOtimizacoes | null {
  const o = bloco<Partial<MtpOtimizacoes>>(pacote, "otimizacoes");
  if (!o) return null;
  const sem = Array.isArray(o.sem_geometria) ? o.sem_geometria : [];
  const com = Array.isArray(o.com_geometria) ? o.com_geometria : [];
  if (sem.length === 0 && com.length === 0) return null;
  return { versao: o.versao ?? 1, sem_geometria: sem, com_geometria: com };
}

/* ── analise_simultaneidade (concorrência de frentes) ───────── */

export interface FrenteSimultaneidade {
  id: string;
  nome: string;
  inicio_dia: number;
  fim_dia: number;
  equipe?: string;
  /** Pico de recurso (ex.: nº de escavadeiras) na janela. */
  recurso_pico?: number;
  cor?: string;
}

export interface MtpSimultaneidade {
  versao: number;
  /** Rótulo do recurso medido (ex.: "escavadeiras", "caminhões"). */
  recurso_rotulo?: string;
  frentes: FrenteSimultaneidade[];
}

export function simultaneidadeDe(
  pacote: MtpPacote | null,
): MtpSimultaneidade | null {
  const s = bloco<MtpSimultaneidade>(pacote, "analise_simultaneidade");
  if (!s || !Array.isArray(s.frentes) || s.frentes.length === 0) return null;
  return s;
}

/* ── recursos.jazidas / recursos.botaForas ──────────────────── */

export interface Jazida {
  id: string;
  nome: string;
  material?: string;
  cbr_pct?: number;
  volume_disp_m3?: number;
  dmt_km?: number;
  royalty_rs_m3?: number;
  /** Coordenadas UTM (para o mapa geotécnico). */
  norte?: number;
  este?: number;
}

export interface BotaFora {
  id: string;
  nome: string;
  capacidade_m3?: number;
  dmt_km?: number;
  norte?: number;
  este?: number;
}

export function jazidasDe(pacote: MtpPacote | null): Jazida[] {
  const r = (pacote as unknown as { recursos?: { jazidas?: unknown } } | null)
    ?.recursos?.jazidas;
  return Array.isArray(r) ? (r as Jazida[]) : [];
}

export function botaForasDe(pacote: MtpPacote | null): BotaFora[] {
  const r = (pacote as unknown as { recursos?: { botaForas?: unknown } } | null)
    ?.recursos?.botaForas;
  return Array.isArray(r) ? (r as BotaFora[]) : [];
}
