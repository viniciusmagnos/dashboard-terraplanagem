import { authFetch, authRequest, getAuthDownloadUrl } from "./api-client";

const BASE_URL = import.meta.env.VITE_SONDAGEM_API_URL || "/api/sondagem";

/* ── Types ─────────────────────────────────────────────── */

export type SondagemType =
  | "percussao"
  | "mista"
  | "rotativa"
  | "trado"
  | "desconhecido";

export type ExtractionMethod =
  | "regex"
  | "pdfplumber_table"
  | "llm_vision"
  | "heuristic"
  | "user"
  | "filename";

export type ReportStatus =
  | "auto"
  | "needs_review"
  | "user_corrected"
  | "error";

export interface FieldConfidence {
  value: number;
  method: ExtractionMethod;
  verified: boolean | null;
  user_corrected: boolean;
}

export interface Coordinates {
  norte: number | null;
  este: number | null;
  fuso: string | null;
  datum: string | null;
  cota_m: number | null;
}

export interface Layer {
  seq: number;
  depth_start: number;
  depth_end: number;
  n1: number | null;
  n2: number | null;
  n3: number | null;
  n_value: number | null;
  penetracao_cm: number | null;
  material: string;
  sucs: string | null;
  granulometria: string | null;
  color: string | null;
  consistency: string | null;
  rqd_pct: number | null;
  recovery_pct: number | null;
}

export interface Stratum {
  seq: number;
  depth_start: number;
  depth_end: number;
  material: string;
  sucs: string | null;
}

export interface WaterLevel {
  encountered: boolean;
  depth_m: number | null;
  observation_date: string | null;
  note: string | null;
}

export interface ProjectMetadata {
  client: string;
  project_name: string;
  sondagem_number: string;
  folha: string;
  operator: string;
  responsavel_tecnico: string;
  company: string;
  data_inicio: string;
  data_termino: string;
  equipamento: string;
  norm_reference: string;
}

export interface SondagemReport {
  report_id: string;
  source_filename: string;
  sondagem_type: SondagemType;
  metadata: ProjectMetadata;
  coordinates: Coordinates;
  layers: Layer[];
  strata: Stratum[];
  water_levels: WaterLevel[];
  profundidade_total_m: number | null;
  confidence: Record<string, FieldConfidence>;
  extraction_cost_usd: number;
  status: ReportStatus;
  template_profile: string;
  warnings: string[];
}

export interface ReportSummary {
  report_id: string;
  source_filename: string;
  n_pages: number;
  profile: string;
  sondagem_type: SondagemType;
  status: ReportStatus;
  overall_confidence: number;
}

export interface UploadResponse {
  session_id: string;
  kind: "single" | "batch";
  n_reports: number;
  reports: ReportSummary[];
  warnings: string[];
}

export interface ExtractResponse {
  session_id: string;
  n_reports: number;
  reports: SondagemReport[];
  total_cost_usd: number;
}

export interface ReportListResponse {
  session_id: string;
  n_reports: number;
  kind: "single" | "batch";
  total_cost_usd: number;
  reports: Array<{
    report_id: string;
    source_filename: string;
    n_pages: number;
    profile: string;
    sondagem_type: SondagemType;
    status: ReportStatus;
    overall_confidence: number;
  }>;
  warnings: string[];
}

/* ── Calls ─────────────────────────────────────────────── */

export async function uploadSondagemFiles(files: File[]): Promise<UploadResponse> {
  if (!files.length) {
    throw new Error("Nenhum arquivo selecionado");
  }
  const fd = new FormData();
  for (const f of files) {
    fd.append("files", f, f.name);
  }
  const res = await authFetch(`${BASE_URL}/upload`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Upload sondagem ${res.status}: ${body}`);
  }
  return res.json();
}

export async function extractSondagem(
  session_id: string,
  options: { report_ids?: string[]; force_llm?: boolean } = {},
): Promise<ExtractResponse> {
  return authRequest<ExtractResponse>(`${BASE_URL}/extract`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id,
      report_ids: options.report_ids ?? null,
      force_llm: options.force_llm ?? false,
    }),
  });
}

export async function listSondagemReports(session_id: string): Promise<ReportListResponse> {
  return authRequest<ReportListResponse>(`${BASE_URL}/reports/${session_id}`);
}

export async function getSondagemReport(
  session_id: string,
  report_id: string,
): Promise<SondagemReport> {
  return authRequest<SondagemReport>(`${BASE_URL}/reports/${session_id}/${report_id}`);
}

export async function patchSondagemReport(
  session_id: string,
  report_id: string,
  edits: Array<{ field_path: string; value: unknown }>,
): Promise<SondagemReport> {
  return authRequest<SondagemReport>(
    `${BASE_URL}/reports/${session_id}/${report_id}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ edits }),
    },
  );
}

export function getSondagemExportUrl(session_id: string): string {
  return getAuthDownloadUrl(`${BASE_URL}/export/${session_id}`);
}

export function getSondagemPreviewUrl(
  session_id: string,
  report_id: string,
  page: number,
  dpi: number = 120,
): string {
  return getAuthDownloadUrl(
    `${BASE_URL}/preview/${session_id}/${report_id}?page=${page}&dpi=${dpi}`,
  );
}

export async function deleteSondagemSession(session_id: string): Promise<void> {
  const res = await authFetch(`${BASE_URL}/session/${session_id}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Delete sondagem ${res.status}`);
  }
}

/* ── Pretty helpers ────────────────────────────────────── */

export const SONDAGEM_TYPE_LABEL: Record<SondagemType, string> = {
  percussao: "Percussão (SPT)",
  mista: "Mista",
  rotativa: "Rotativa",
  trado: "Trado",
  desconhecido: "Desconhecido",
};

export function formatBrazilNumber(n: number | null, decimals: number = 2): string {
  if (n === null || n === undefined) return "—";
  return n
    .toFixed(decimals)
    .replace(".", ",")
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
