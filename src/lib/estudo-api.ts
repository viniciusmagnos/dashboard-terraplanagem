/**
 * Client dos ESTUDOS do dashboard de terraplenagem (backend landxml,
 * /api/estudos/*). O estudo server-side é a fonte da verdade compartilhada
 * com o agente AskCAD (tools estudo_*) e o MCP (terraplenagem_*): o
 * EstudoContext sincroniza o estado local (LS) com ele.
 */
import { authFetch, getAuthDownloadUrl } from "./api-client";
import type { EstudoPersistido } from "./cenario";

// BASE_URL já resolve para a raiz `/api` do backend landxml (dev: proxy
// `/api/landxml/*` → `:8011/api/*`; prod: `.../landxml/api`). Por isso os
// paths abaixo usam `/estudos`, NÃO `/api/estudos` (senão vira `/api/api/…`).
const BASE_URL = import.meta.env.VITE_LANDXML_API_URL || "/api/landxml";

/**
 * Chave LS do binding projeto → estudo_id do servidor. Compartilhada entre o
 * bootstrap do EstudoContext e o fluxo "Abrir estudo do servidor" do
 * DashboardPage (essencial p/ estudos compartilhados: mantém o dashboard
 * vinculado ao estudo do DONO, e não a um estudo próprio do mesmo projeto).
 */
export const chaveVinculoEstudo = (projetoId: string) =>
  `manta:landxml:estudo-id:${projetoId}`;

export interface EstudoMeta {
  estudo_id: string;
  projeto_id: string;
  nome: string;
  rev: number;
  schema_version: number;
  pacote_bytes: number;
  pacote_hash: string;
  created_at: string;
  updated_at: string;
}

/** Papel do usuário logado no estudo (compartilhamento). */
export type EstudoRole = "owner" | "editor";

export interface EstudoResumo extends EstudoMeta {
  role: EstudoRole;
  owner_id: number;
  is_shared: boolean;
  n_participantes: number;
  n_cenarios: number;
  kpis: {
    corte_total_m3: number | null;
    aterro_fc_m3: number | null;
    momento_m3km: number | null;
  };
}

export interface EstudoParticipante {
  user_id: number;
  role: EstudoRole;
  added_at: string;
  added_by_user_id: number;
  is_self: boolean;
}

export type EstudoDigest = Record<string, unknown> & {
  estudo_id: string;
  nome: string;
  rev: number;
};

export interface EstadoResponse {
  changed: boolean;
  rev: number;
  role?: EstudoRole;
  estado?: EstudoPersistido;
}

export type PutEstadoResult =
  | { rev: number; conflict?: undefined }
  | { conflict: true; rev: number; estado: EstudoPersistido };

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail =
        typeof body?.detail === "string"
          ? body.detail
          : JSON.stringify(body?.detail ?? body);
    } catch {
      detail = res.statusText;
    }
    throw new Error(`Estudos: ${res.status} — ${detail}`);
  }
  return res.json() as Promise<T>;
}

export async function listarEstudos(projetoId?: string): Promise<EstudoResumo[]> {
  const q = projetoId ? `?projeto_id=${encodeURIComponent(projetoId)}` : "";
  const res = await authFetch(`${BASE_URL}/estudos${q}`);
  const body = await jsonOrThrow<{ estudos: EstudoResumo[] }>(res);
  return body.estudos;
}

/**
 * Cria o estudo do pacote; se já existir um para (usuário, projeto), o
 * backend responde 409 com o estudo_id existente — devolvemos ele com
 * `criado: false` (o chamador então adota o estado do servidor).
 */
export async function criarEstudo(
  pacoteTexto: string,
  meta: { nome?: string; estado?: EstudoPersistido },
): Promise<{ estudo_id: string; rev: number; criado: boolean }> {
  const form = new FormData();
  form.append(
    "pacote",
    new Blob([pacoteTexto], { type: "application/json" }),
    "pacote.mtp.json",
  );
  form.append("meta", JSON.stringify(meta));
  const res = await authFetch(`${BASE_URL}/estudos`, {
    method: "POST",
    body: form,
  });
  if (res.status === 409) {
    const body = (await res.json()) as {
      detail: { estudo_id: string; rev: number };
    };
    return { estudo_id: body.detail.estudo_id, rev: body.detail.rev, criado: false };
  }
  const body = await jsonOrThrow<EstudoMeta>(res);
  return { estudo_id: body.estudo_id, rev: body.rev, criado: true };
}

export async function obterEstudo(
  estudoId: string,
): Promise<EstudoMeta & { estado: EstudoPersistido }> {
  const res = await authFetch(`${BASE_URL}/estudos/${estudoId}`);
  return jsonOrThrow(res);
}

export async function obterEstado(
  estudoId: string,
  sinceRev?: number,
): Promise<EstadoResponse> {
  const q = sinceRev != null ? `?since_rev=${sinceRev}` : "";
  const res = await authFetch(`${BASE_URL}/estudos/${estudoId}/estado${q}`);
  return jsonOrThrow(res);
}

export async function putEstado(
  estudoId: string,
  estado: EstudoPersistido,
  rev: number,
): Promise<PutEstadoResult> {
  const res = await authFetch(`${BASE_URL}/estudos/${estudoId}/estado`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ estado, rev }),
  });
  if (res.status === 409) {
    const body = (await res.json()) as {
      detail: { rev: number; estado: EstudoPersistido };
    };
    return { conflict: true, rev: body.detail.rev, estado: body.detail.estado };
  }
  return jsonOrThrow<{ rev: number }>(res);
}

export async function obterDigest(estudoId: string): Promise<EstudoDigest> {
  const res = await authFetch(`${BASE_URL}/estudos/${estudoId}/digest`);
  return jsonOrThrow(res);
}

export async function substituirPacote(
  estudoId: string,
  pacoteTexto: string,
): Promise<EstudoMeta> {
  const form = new FormData();
  form.append(
    "pacote",
    new Blob([pacoteTexto], { type: "application/json" }),
    "pacote.mtp.json",
  );
  const res = await authFetch(`${BASE_URL}/estudos/${estudoId}/pacote`, {
    method: "PUT",
    body: form,
  });
  return jsonOrThrow(res);
}

export async function deletarEstudo(estudoId: string): Promise<void> {
  const res = await authFetch(`${BASE_URL}/estudos/${estudoId}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Estudos: falha ao deletar (${res.status})`);
  }
}

/* ── Compartilhamento ─────────────────────────────────────── */

/**
 * Baixa o texto do pacote .mtp.json do estudo — usado para ABRIR um estudo
 * compartilhado (quem recebeu não tem o pacote no IndexedDB local).
 */
export async function obterPacoteTexto(estudoId: string): Promise<string> {
  const res = await authFetch(`${BASE_URL}/estudos/${estudoId}/pacote`);
  if (!res.ok) {
    throw new Error(`Estudos: falha ao baixar o pacote (${res.status})`);
  }
  return res.text();
}

export async function listarParticipantes(
  estudoId: string,
): Promise<{ owner_id: number; participants: EstudoParticipante[] }> {
  const res = await authFetch(`${BASE_URL}/estudos/${estudoId}/participantes`);
  return jsonOrThrow(res);
}

/** Convida um usuário como editor do estudo (só o dono). Idempotente. */
export async function compartilharEstudo(
  estudoId: string,
  userId: number,
): Promise<{ inserted: boolean }> {
  const res = await authFetch(`${BASE_URL}/estudos/${estudoId}/compartilhar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
  });
  return jsonOrThrow(res);
}

/** Dono remove qualquer editor; editor remove a si mesmo (sai do estudo). */
export async function descompartilharEstudo(
  estudoId: string,
  userId: number,
): Promise<void> {
  const res = await authFetch(
    `${BASE_URL}/estudos/${estudoId}/compartilhar/${userId}`,
    { method: "DELETE" },
  );
  if (!res.ok) {
    throw new Error(`Estudos: falha ao remover participante (${res.status})`);
  }
}

/* ── Export XLSX por assunto ──────────────────────────────── */

/** Tipos aceitos por GET /api/estudos/{id}/export/{tipo}. */
export type ExportTipo =
  | "geral"
  | "tracado"
  | "bruckner"
  | "volumes"
  | "geotecnia"
  | "orcamento"
  | "comparativo"
  | "completo";

/**
 * URL de download do XLSX do estudo (com `?token=` — o endpoint aceita o JWT
 * na query para funcionar via `<a href>`). `cenarioId` vale para
 * bruckner/volumes/orcamento/completo; `sondagemId` filtra a geotecnia
 * para um furo só.
 */
export function urlExportEstudo(
  estudoId: string,
  tipo: ExportTipo,
  opts?: {
    cenarioId?: string | null;
    sondagemId?: string;
    includeCurve?: boolean;
  },
): string {
  const p = new URLSearchParams();
  if (opts?.cenarioId) p.set("cenario_id", opts.cenarioId);
  if (opts?.sondagemId) p.set("sondagem_id", opts.sondagemId);
  if (opts?.includeCurve === false) p.set("include_curve", "false");
  const q = p.toString();
  return getAuthDownloadUrl(
    `${BASE_URL}/estudos/${estudoId}/export/${tipo}${q ? `?${q}` : ""}`,
  );
}
