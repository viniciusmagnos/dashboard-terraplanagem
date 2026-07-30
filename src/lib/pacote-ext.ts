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

/* ── comparativo_secoes (conferência contra o Civil 3D) ─────── */
//
// Bloco de AUDITORIA: compara, estaca a estaca, as áreas de corte/aterro que o
// dashboard extraiu com as que o Civil 3D exportou nas seções (CrossSectSurf
// terreno + DATUM). Só existe quando o projetista gera as sample lines com as
// superfícies do corredor — nem todo LandXML as traz (ver RELATORIO na pasta
// _manta_dashboard do projeto).
//
// Convenção validada em 2026-07-29 no BR-376 Contorno de Ponta Grossa: a área
// de corte/aterro do Civil 3D é `terreno × DATUM` (topo do subleito), com a
// CFT (camada final de terraplenagem, ~0,60 m sob o DATUM) FORA da conta —
// batendo com os polígonos da "Lista de Materiais" do próprio Civil 3D em
// 0,003 %.

export interface CompSecaoLinha {
  /** Estaca em metros ao longo do eixo. */
  sta: number;
  /** Rótulo de estaca ("112+7.582"). */
  est: string;
  /** Área de corte do Civil 3D (terreno × DATUM), m². */
  c_ref: number;
  /** Área de aterro do Civil 3D (terreno × DATUM), m². */
  f_ref: number;
  /** Área de corte se a CFT entrasse na conta, m² (só informativo). */
  c_cft?: number | null;
  f_cft?: number | null;
  /** Área dos polígonos da Lista de Materiais do Civil 3D, m² (quando existem). */
  c_mat?: number | null;
  f_mat?: number | null;
  /** Volume do bin correspondente no pacote atual, m³. */
  vc_dash?: number | null;
  vf_dash?: number | null;
  /** Volume recalculado com as áreas de referência, m³. */
  vc_ref?: number | null;
  vf_ref?: number | null;
  /** A swath da sample line cortou a seção → área de referência SUBESTIMADA. */
  trunc?: boolean;
  /** Área absurda vs vizinhas (extrapolação do corredor) → descartada. */
  extrap?: boolean;
  /** Largura do terreno / do DATUM na seção, m (diagnóstico do truncamento). */
  w_ter?: number | null;
  w_dat?: number | null;
}

export interface CompSecaoEixo {
  eixo_id: string;
  linhas: CompSecaoLinha[];
  n: number;
  /** Nº de seções truncadas pela swath da sample line. */
  n_trunc: number;
  /** Nº de seções descartadas por extrapolação. */
  n_extrap: number;
  /** Rótulos das estacas descartadas ("112+7.582"). */
  estacas_extrap: string[];
  /** Fração (0–1) da área de aterro que cai em seção truncada. */
  frac_aterro_trunc?: number;
  /** Volumes: referência (Civil 3D) x pacote atual. */
  v_ref: { corte: number; aterro: number };
  v_dash: { corte: number; aterro: number };
  /** Referência ANTES de descartar as extrapoladas (para mostrar o estrago). */
  v_ref_bruto?: { corte: number; aterro: number };
}

export interface MtpComparativoSecoes {
  versao: number;
  /** Arquivo LandXML de onde vieram as seções de referência. */
  fonte: string;
  /** ISO da geração do bloco. */
  gerado_em?: string;
  /** Convenção usada na referência (texto curto para a tela). */
  convencao?: string;
  /** Volumes TIN×TIN do próprio Civil 3D (<SurfVolumes>), quando presentes. */
  surf_volumes?: { nome: string; corte: number; aterro: number }[];
  eixos: CompSecaoEixo[];
  avisos?: string[];
}

export function comparativoSecoesDe(
  pacote: MtpPacote | null,
): MtpComparativoSecoes | null {
  const c = bloco<MtpComparativoSecoes>(pacote, "comparativo_secoes");
  if (!c || !Array.isArray(c.eixos) || c.eixos.length === 0) return null;
  return c;
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
