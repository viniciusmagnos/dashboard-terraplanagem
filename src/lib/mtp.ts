// =====================================================
// manta-terraplenagem-package v1 (.mtp.json) — tipos +
// validação leve no frontend do hub.
// Fonte da verdade do schema: Pydantic em
// backends/shared/manta_shared/dashboard_package.py
// (o backend gera; aqui só conferimos o essencial).
// =====================================================

import type { BrucknerResult } from "./bruckner";

export const MTP_SCHEMA = "manta-terraplenagem-package";
// v1 = escalar (bins + Brückner); v2 = v1 + bloco opcional `geometria`
export const MTP_SCHEMA_VERSION = 2;

export type Provenance =
  | "extracted"
  | "computed"
  | "manual"
  | "default"
  | "example";

export interface MtpEixoVolumes {
  corte_total: number;
  aterro: number;
  pavimento: number;
  corte_1cat: number | null;
  corte_2cat: number | null;
  corte_3cat: number | null;
  jazida: number | null;
  bf_total: number | null;
  bf_1cat: number | null;
  bf_3cat: number | null;
}

export interface MtpEixo {
  id: string;
  nome: string;
  tipo: "rodovia" | "acesso" | "rotatoria" | "transicao";
  sta_inicio_m: number;
  sta_fim_m: number;
  extensao_m: number;
  n_estacas: number;
  volumes: MtpEixoVolumes;
  tem_servico: boolean;
  provenance: Provenance;
}

export interface MtpBin {
  eixo_id: string;
  sta_a: number;
  sta_b: number;
  v_corte: number;
  v_aterro: number;
  v_pavimento: number;
}

export interface MtpBarreira {
  sta_m: number;
  nome: string;
  tipo: string;
}

/* ── Bloco de geometria (schema v2, opcional) ─────────────── */

export interface MtpGeoTracado {
  passo_m: number;
  sta0_m: number;
  /** flat [e0, n0, e1, n1, ...] — já − world_offset; estação do vértice i = sta0_m + i·passo_m */
  en: number[];
}

export interface MtpGeoPerfil {
  passo_m: number;
  sta0_m: number;
  /** z − z_offset_m; null fora da cobertura */
  greide_z: (number | null)[];
  terreno_z: (number | null)[];
}

export interface MtpGeoSecao {
  sta_m: number;
  /** flat [offset, z, ...] (z − z_offset_m); offset+ = lado direito */
  terreno: number[];
  plataforma: number[];
  /** linha da CFT (camada final de terraplenagem, ~0,6 m sob a plataforma);
   *  flat [offset, z, ...] restrito à largura da plataforma; ausente/[] se n/d */
  cft?: number[];
  area_corte: number;
  area_aterro: number;
  /** source_mode do adaptador (auditoria) */
  fonte: string;
}

export interface MtpGeoEixo {
  eixo_id: string;
  tracado: MtpGeoTracado | null;
  perfil: MtpGeoPerfil | null;
  secoes: MtpGeoSecao[];
  secoes_passo_m: number;
}

export interface MtpGeometria {
  world_offset: [number, number];
  z_offset_m: number;
  params: Record<string, number>;
  eixos: MtpGeoEixo[];
  warnings: string[];
}

/* ── Bloco de geotecnia (sondagens projetadas nos eixos) ───── */

export interface MtpSondagemCamada {
  de_m: number;
  a_m: number;
  n_spt: number | null;
  material: string;
  /** Categoria de escavação DNIT inferida (1=solo, 2=rocha alterada, 3=rocha sã) */
  categoria?: number | null;
}

/** Ensaio de caracterização de laboratório (amostra deformada de trado). */
export interface MtpEnsaioLab {
  furo_id: string;
  ident: string;
  registro: string;
  prof_de_m: number | null;
  prof_a_m: number | null;
  energia: string | null; // Proctor: PN | PI
  w_nat_pct: number | null; // umidade natural
  w_ot_pct: number | null; // umidade ótima
  gamma_d_max_knm3: number | null;
  cbr_pct: number | null;
  expansao_pct: number | null;
  mct: string | null; // classe MCT
  ll_pct: number | null;
  lp_pct: number | null;
  ip_pct: number | null;
  hrb: string | null; // TRB/AASHTO
  uscs: string | null;
  massa_esp_ap_gcm3: number | null;
  dens_real_graos: number | null;
  granulometria: Record<string, number>; // peneira → % passa
  fonte: string;
}

export interface MtpSondagem {
  id: string;
  tipo: string; // percussao | trado | mista | poco | desconhecido
  arquivo: string;
  norte: number | null;
  este: number | null;
  cota_m: number | null;
  /** "rt_locada" quando a cota veio do RT de investigações; null = boletim */
  cota_fonte?: string | null;
  prof_total_m: number | null;
  na_m: number | null;
  na_seco: boolean | null;
  eixo_id: string | null;
  sta_m: number | null;
  /** positivo = lado direito do estaqueamento */
  offset_m: number | null;
  camadas: MtpSondagemCamada[];
  solo_mole_ate_m: number | null;
  impenetravel_m: number | null;
  /** RT (mistas): espessura de solo / rocha até o impenetrável */
  esp_solo_m?: number | null;
  esp_rocha_m?: number | null;
  motivo_paralisacao?: string | null;
  /** Ensaios de laboratório casados ao furo (RT + consolidado) */
  ensaios?: MtpEnsaioLab[];
  confianca: number;
}

export interface MtpGeotecnia {
  versao: number;
  sondagens: MtpSondagem[];
  resumo: {
    n_total: number;
    n_posicionadas: number;
    n_com_coordenada: number;
    por_tipo: Record<string, number>;
    prof_media_m: number | null;
    na_medio_m: number | null;
    n_com_solo_mole: number;
    n_com_impenetravel: number;
    n_com_ensaios?: number;
    n_amostras_lab?: number;
  };
  /** % de categorias de escavação inferidos das camadas (por espessura) */
  categorias?: {
    pct_1cat: number;
    pct_2cat: number;
    pct_3cat: number;
    espessura_total_m: number;
    n_furos: number;
    fonte: string;
  } | null;
  /** Cruzamento furo × perfil de corte por bin (preenchido pelo builder) */
  materiais?: MtpGeotecniaMateriais | null;
  params: Record<string, number>;
  warnings: string[];
}

export interface MtpMateriaisEixo {
  eixo_id: string;
  n_furos: number;
  v_corte_total: number;
  v_corte_coberto: number;
  corte_1cat: number;
  corte_2cat: number;
  corte_3cat: number;
  aterro_total: number;
  aterro_solo_mole_m: number;
  v_solo_mole: number;
}

export interface MtpBinMaterial {
  eixo_id: string;
  sta_a: number;
  sta_b: number;
  furo_id: string;
  dist_m: number;
  prof_corte_m: number;
  frac_1cat: number;
  frac_2cat: number;
  frac_3cat: number;
  solo_mole: boolean;
  solo_mole_esp_m: number | null;
}

export interface MtpGeotecniaMateriais {
  versao: number;
  max_dist_m: number;
  /** fração do V de corte global com furo a ≤ max_dist_m */
  cobertura_corte: number;
  corte_1cat: number;
  corte_2cat: number;
  corte_3cat: number;
  v_solo_mole: number;
  aterro_solo_mole_km: number;
  por_eixo: MtpMateriaisEixo[];
  bins: MtpBinMaterial[];
  warnings: string[];
}

/** Bloco `sondagens` tipado (null quando ausente/formato desconhecido). */
export function geotecniaDe(pacote: MtpPacote | null): MtpGeotecnia | null {
  const g = pacote?.sondagens as MtpGeotecnia | null | undefined;
  if (!g || !Array.isArray(g.sondagens) || !g.resumo) return null;
  return g;
}

/* ── Bloco perfil_geologico (horizontes do DWG de perfil) ──── */

/** Polyline de horizonte: pares [estação_m, cota_m] ordenados por estação. */
export interface MtpLinhaHorizonte {
  pts: [number, number][];
}

export interface MtpPerfilEixo {
  eixo_id: string;
  titulo: string;
  sta_min_m: number;
  sta_max_m: number;
  terreno: [number, number][];
  greide: [number, number][];
  /** topo da rocha alterada mole (RAM) → início da 2ª categoria */
  topo_2cat: MtpLinhaHorizonte[];
  /** topo da rocha alterada dura/sã (RAD) → início da 3ª categoria */
  topo_3cat: MtpLinhaHorizonte[];
  na: MtpLinhaHorizonte[];
  contatos: MtpLinhaHorizonte[];
  cal: Record<string, number>;
}

export interface MtpCategoriaHorizonteEixo {
  eixo_id: string;
  v_corte_total: number;
  v_corte_coberto: number;
  corte_1cat: number;
  corte_2cat: number;
  corte_3cat: number;
}

export interface MtpPerfilGeologico {
  versao: number;
  eixos: MtpPerfilEixo[];
  categorias_por_eixo: MtpCategoriaHorizonteEixo[];
  params: Record<string, unknown>;
  warnings: string[];
}

/** Bloco `perfil_geologico` tipado (null quando ausente). */
export function perfilGeologicoDe(
  pacote: MtpPacote | null,
): MtpPerfilGeologico | null {
  const p = pacote?.perfil_geologico as MtpPerfilGeologico | null | undefined;
  if (!p || !Array.isArray(p.eixos) || p.eixos.length === 0) return null;
  return p;
}

export interface MtpPacote {
  schema: typeof MTP_SCHEMA;
  schema_version: number;
  generated_at: string;
  generator: {
    tool: string;
    mode: string;
    source_files: { filename: string; size_bytes: number }[];
  };
  projeto: {
    id: string;
    nome: string;
    cliente: string;
    descricao: string;
    unidades: {
      volume: string;
      dmt: string;
      estaca_m: number;
      moeda: string;
      estacao: "m_absoluto" | "km_rodovia";
    };
  };
  eixos: MtpEixo[];
  bins: MtpBin[];
  bins_meta: { largura_m: number; modo: string; gap_split_m: number };
  bruckner: BrucknerResult | null;
  barreiras: MtpBarreira[];
  volumes_base: Record<string, number | null> & {
    corteTotal: number;
    aterroFc: number;
  };
  categorias: {
    modo: string;
    pct_3cat_default: number;
    pct_2cat_default: number;
    evidencias: unknown[];
  };
  extensoes: {
    total: number;
    semServico: number;
    comServico: number;
    rodoviasPrincipais: number;
    acessos: number;
  };
  premissas_default: Record<string, number>;
  custos: Record<string, number> | null;
  recursos: { jazidas: unknown[]; botaForas: unknown[] };
  sondagens: unknown | null;
  /** Bloco opcional v2 (ausente/null em pacotes v1) */
  geometria?: MtpGeometria | null;
  /** Bloco opcional: horizontes geológicos do DWG de perfil */
  perfil_geologico?: unknown | null;
  provenance: Record<string, Provenance>;
  warnings: string[];
}

export class MtpInvalidoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MtpInvalidoError";
  }
}

/** Validação leve (schema, versão e campos essenciais). */
export function validarPacote(input: unknown): MtpPacote {
  let data: unknown = input;
  if (typeof input === "string") {
    try {
      data = JSON.parse(input);
    } catch {
      throw new MtpInvalidoError("Arquivo não é JSON válido");
    }
  }
  const obj = data as Record<string, unknown>;
  if (obj?.schema !== MTP_SCHEMA) {
    throw new MtpInvalidoError(
      `Arquivo não é um pacote ${MTP_SCHEMA} (schema="${String(obj?.schema)}")`,
    );
  }
  if (
    typeof obj.schema_version === "number" &&
    obj.schema_version > MTP_SCHEMA_VERSION
  ) {
    throw new MtpInvalidoError(
      `Pacote na versão ${obj.schema_version}; este hub entende até a versão ${MTP_SCHEMA_VERSION}.`,
    );
  }
  for (const campo of ["projeto", "eixos", "bins", "volumes_base"]) {
    if (!(campo in obj)) {
      throw new MtpInvalidoError(`Pacote sem o bloco obrigatório "${campo}"`);
    }
  }
  return obj as unknown as MtpPacote;
}

/* ── Helpers de estação (m absoluto ↔ km ↔ estaca 20 m) ───── */

export function staToKmLabel(staM: number): string {
  const km = Math.floor(staM / 1000);
  const m = Math.round(staM - km * 1000);
  return `km ${km}+${String(m).padStart(3, "0")}`;
}

export function staToKm(staM: number): number {
  return staM / 1000;
}

/** Proveniência com fallback por prefixo (bloco.campo → bloco → manual). */
export function provenanceDe(pacote: MtpPacote | null, key: string): Provenance {
  const map = pacote?.provenance ?? {};
  if (map[key]) return map[key];
  const prefix = key.split(".")[0];
  if (map[prefix]) return map[prefix];
  return "manual";
}
