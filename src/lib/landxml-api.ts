import { authFetch, getAuthDownloadUrl } from "./api-client";

const BASE_URL = import.meta.env.VITE_LANDXML_API_URL || "/api/landxml";

/* ── Types ─────────────────────────────────────────────────── */

export interface ProjectInfo {
  name: string;
  application: string;
  application_version: string;
  date: string;
  time: string;
  horizontal_datum: string;
  coord_system_name: string;
  coord_system_desc: string;
  units_linear: string;
  units_area: string;
  units_volume: string;
}

export interface AlignmentSummary {
  name: string;
  sta_start: number;
  length: number;
  n_lines: number;
  n_curves: number;
  n_spirals: number;
  has_profile: boolean;
  n_pvi: number;
  n_cross_sects: number;
  bounds: [number, number, number, number] | null;
}

export interface SurfaceSummary {
  name: string;
  desc: string;
  surf_type: string;
  n_points: number;
  n_faces: number;
  elev_min: number;
  elev_max: number;
  area_2d: number;
  area_3d: number;
}

export interface SurfVolume {
  name: string;
  desc: string;
  surf_base: string;
  surf_compare: string;
  vol_cut: number;
  vol_fill: number;
  vol_total: number;
}

export interface RoadwaySummary {
  name: string;
  alignment_refs: string[];
  surface_refs: string[];
  sta_start: number;
  sta_end: number;
}

export interface UploadResponse {
  session_id: string;
  filename: string;
  file_size_bytes: number;
  project: ProjectInfo;
  n_alignments: number;
  n_profiles: number;
  n_roadways: number;
  n_cross_sections: number;
  n_surfaces: number;
  n_volumes: number;
  n_plan_features: number;
  alignments: AlignmentSummary[];
  surfaces: SurfaceSummary[];
  volumes: SurfVolume[];
  roadways: RoadwaySummary[];
  warnings: string[];
}

export interface LineSeg {
  kind: "Line";
  start: [number, number];
  end: [number, number];
  direction: number;
  length: number;
}

export interface CurveSeg {
  kind: "Curve";
  start: [number, number];
  end: [number, number];
  center: [number, number] | null;
  pi: [number, number] | null;
  radius: number;
  length: number;
  chord: number;
  delta: number;
  direction_start: number;
  direction_end: number;
  rotation: "cw" | "ccw";
  crv_type: string;
}

export interface SpiralSeg {
  kind: "Spiral";
  start: [number, number];
  end: [number, number];
  length: number;
  radius_start: number | null;
  radius_end: number | null;
  direction_start: number;
  direction_end: number;
  rotation: "cw" | "ccw";
  spi_type: string;
}

export type AlignmentSegment = LineSeg | CurveSeg | SpiralSeg;

export interface AlignmentDetail {
  name: string;
  sta_start: number;
  length: number;
  desc: string;
  segments: AlignmentSegment[];
}

export interface PVI {
  station: number;
  elevation: number;
}

export interface ParaCurve {
  length: number;
  station: number;
  elevation: number;
}

export interface ProfAlign {
  name: string;
  pvis: PVI[];
  para_curves: ParaCurve[];
}

export interface ProfSurf {
  name: string;
  state: string;
  points: [number, number][];
}

export interface ProfileData {
  name: string;
  surfaces: ProfSurf[];
  aligns: ProfAlign[];
}

/* ── API methods ───────────────────────────────────────────── */

export async function uploadFile(file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await authFetch(`${BASE_URL}/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/** Gera o pacote manta-terraplenagem-package (.mtp.json) de N sessões vivas. */
export async function exportDashboardPackage(params: {
  session_ids: string[];
  projeto: { id: string; nome: string; cliente?: string; descricao?: string };
  barriers?: { sta_m: number; nome?: string; tipo?: string }[];
  fill_factor?: number;
  baseline?: string | number;
  gap_split_m?: number;
  /** Embute o bloco de geometria (pacote v2 — abas Seções e 3D). */
  geometria?: boolean;
  /** Laudos crus de sondagem (saída do scripts/extract_sondagens.py) —
   * projetados nos eixos e embutidos no bloco `sondagens` (aba Geotecnia). */
  sondagens?: unknown[];
  sondagens_max_offset?: number;
  /** Regexes de eixos a excluir (ex.: ["_[DE]$"] p/ alinhamentos de bordo). */
  exclude_eixos?: string[];
}): Promise<unknown> {
  const res = await authFetch(`${BASE_URL}/export/dashboard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_ids: params.session_ids,
      projeto: params.projeto,
      barriers: params.barriers ?? [],
      fill_factor: params.fill_factor ?? 1.0,
      baseline: params.baseline ?? "start",
      gap_split_m: params.gap_split_m ?? 200.0,
      geometria: params.geometria ?? false,
      sondagens: params.sondagens ?? null,
      sondagens_max_offset: params.sondagens_max_offset ?? 150.0,
      exclude_eixos: params.exclude_eixos ?? [],
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getSummary(sessionId: string): Promise<UploadResponse> {
  const res = await authFetch(`${BASE_URL}/summary/${sessionId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listAlignments(sessionId: string): Promise<{
  session_id: string;
  alignments: (AlignmentSummary & { segments: AlignmentSegment[] })[];
}> {
  const res = await authFetch(`${BASE_URL}/alignments/${sessionId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getAlignment(
  sessionId: string,
  name: string,
): Promise<{
  summary: AlignmentSummary;
  alignment: AlignmentDetail;
  has_profile: boolean;
}> {
  const res = await authFetch(
    `${BASE_URL}/alignment/${sessionId}/${encodeURIComponent(name)}`,
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getProfile(
  sessionId: string,
  name: string,
): Promise<ProfileData> {
  const res = await authFetch(
    `${BASE_URL}/profile/${sessionId}/${encodeURIComponent(name)}`,
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export interface CrossSectPoint {
  offset: number;
  elevation: number;
}

export interface ExistingSurf {
  name: string;
  desc: string;
  points: CrossSectPoint[];
}

export interface DesignSurfLink {
  name: string;
  side: "left" | "right" | "";
  closed_area: boolean;
  area: number;
  points: CrossSectPoint[];
}

export interface CrossSect {
  station: number;
  station_label: string;
  existing: ExistingSurf[];
  design: DesignSurfLink[];
}

export interface CrossSectSummary {
  alignment_name: string;
  n_sections: number;
  sta_min: number;
  sta_max: number;
  materials: Record<string, number>;
}

export interface SectionsListResponse {
  alignment: string;
  summary: CrossSectSummary;
  offset: number;
  limit: number;
  total: number;
  sections: CrossSect[];
}

export async function listSections(
  sessionId: string,
  alignment: string,
  options: { offset?: number; limit?: number; includeUnnamed?: boolean } = {},
): Promise<SectionsListResponse> {
  const params = new URLSearchParams();
  if (options.offset !== undefined) params.set("offset", String(options.offset));
  if (options.limit !== undefined) params.set("limit", String(options.limit));
  if (options.includeUnnamed) params.set("include_unnamed", "true");
  const qs = params.toString();
  const url = `${BASE_URL}/sections/${sessionId}/${encodeURIComponent(alignment)}${qs ? "?" + qs : ""}`;
  const res = await authFetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getSection(
  sessionId: string,
  alignment: string,
  station: number,
  options: { tolerance?: number; includeUnnamed?: boolean } = {},
): Promise<CrossSect> {
  const params = new URLSearchParams();
  if (options.tolerance !== undefined) params.set("tolerance", String(options.tolerance));
  if (options.includeUnnamed) params.set("include_unnamed", "true");
  const qs = params.toString();
  const url = `${BASE_URL}/section/${sessionId}/${encodeURIComponent(alignment)}/${station}${qs ? "?" + qs : ""}`;
  const res = await authFetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listVolumes(
  sessionId: string,
): Promise<{ session_id: string; volumes: SurfVolume[] }> {
  const res = await authFetch(`${BASE_URL}/volumes/${sessionId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listSurfaces(
  sessionId: string,
): Promise<{ session_id: string; surfaces: SurfaceSummary[] }> {
  const res = await authFetch(`${BASE_URL}/surfaces/${sessionId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getGeometry(
  sessionId: string,
  view: "plant" | "profile" = "plant",
  alignment?: string,
): Promise<unknown> {
  const params = new URLSearchParams({ view });
  if (alignment) params.set("alignment", alignment);
  const res = await authFetch(
    `${BASE_URL}/geometry/${sessionId}?${params.toString()}`,
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getContoursGeometry(
  sessionId: string,
  surfaceName: string,
  step: number = 1.0,
): Promise<unknown> {
  const res = await authFetch(
    `${BASE_URL}/contours-geometry/${sessionId}/${encodeURIComponent(surfaceName)}?step=${step}`,
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteSession(sessionId: string): Promise<void> {
  await authFetch(`${BASE_URL}/session/${sessionId}`, { method: "DELETE" });
}

export function getExportUrl(sessionId: string, type: string = "all") {
  return getAuthDownloadUrl(`${BASE_URL}/export/${sessionId}?type=${type}`);
}

export function getBalancoExportUrl(sessionId: string) {
  return getAuthDownloadUrl(`${BASE_URL}/export/balanco/${sessionId}`);
}

export function getPavimentacaoExportUrl(sessionId: string) {
  return getAuthDownloadUrl(`${BASE_URL}/export/pavimentacao/${sessionId}`);
}

export async function getBalancoHandoff(sessionId: string): Promise<unknown> {
  const res = await authFetch(`${BASE_URL}/handoff/balanco/${sessionId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export interface BalancoTableRow {
  estaca_label: string;
  station: number;
  area_corte: number;
  area_aterro: number;
  area_pavimento: number;
  area_expurgo: number;
  delta_m: number;
  v_corte: number;
  v_aterro: number;
  v_pavimento: number;
  v_expurgo: number;
  v_acum_corte: number;
  v_acum_aterro: number;
  v_liquido: number;
  source_mode: string;
}

export interface BalancoTotals {
  area_corte: number;
  area_aterro: number;
  area_pavimento: number;
  area_expurgo: number;
  v_corte: number;
  v_aterro: number;
  v_pavimento: number;
  v_expurgo: number;
  v_liquido: number;
}

export interface SurfVolumeRef {
  surfvolume_name: string;
  branches_covered: string[];
  vol_cut_xml: number;
  vol_fill_xml: number;
  sum_v_cut_calc: number;
  sum_v_fill_calc: number;
  delta_pct_cut: number;
  delta_pct_fill: number;
}

export interface BalancoTableResponse {
  ramo: string;
  rows: BalancoTableRow[];
  totals: BalancoTotals;
  surfvolume_ref: SurfVolumeRef | null;
  available_ramos: string[];
}

export async function getBalancoTable(
  sessionId: string,
  ramo: string,
): Promise<BalancoTableResponse> {
  const res = await authFetch(
    `${BASE_URL}/balanco-table/${sessionId}/${encodeURIComponent(ramo)}`,
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getPavimentacaoHandoff(sessionId: string): Promise<unknown> {
  const res = await authFetch(`${BASE_URL}/handoff/pavimentacao/${sessionId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
