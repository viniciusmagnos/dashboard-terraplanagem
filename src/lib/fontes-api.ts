// APP-LOCAL — não adicionar ao sync-from-hub.
//
// Client das FONTES LandXML brutas do estudo (/api/estudos/{id}/fontes*).
// As fontes habilitam o assistente IA a explorar o bruto (cota exata, seções
// cruas, SQL no índice de agregados) — ver também o data-map do estudo.
import { authFetch } from "./api-client";

const BASE_URL = import.meta.env.VITE_LANDXML_API_URL || "/api/landxml";

export interface FonteXml {
  fonte_id: string;
  filename: string;
  sha256: string;
  bytes: number;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface IndexStatus {
  status: "sem_fontes" | "pendente" | "building" | "ready" | "failed" | "stale";
  n_fontes?: number;
  n_sections?: number;
  built_at?: string | null;
  duration_s?: number | null;
  error?: string | null;
}

export interface FontesResponse {
  fontes: FonteXml[];
  index_status: IndexStatus;
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail ?? body);
    } catch {
      /* corpo não-JSON */
    }
    throw new Error(detail);
  }
  return res.json();
}

export async function listarFontesXml(estudoId: string): Promise<FontesResponse> {
  const res = await authFetch(`${BASE_URL}/estudos/${estudoId}/fontes`);
  return jsonOrThrow(res);
}

export async function anexarFonteXml(
  estudoId: string,
  file: File,
): Promise<{ fonte: FonteXml; ja_existia: boolean; index_status: IndexStatus }> {
  const form = new FormData();
  form.append("file", file);
  const res = await authFetch(`${BASE_URL}/estudos/${estudoId}/fontes`, {
    method: "POST",
    body: form,
  });
  return jsonOrThrow(res);
}

/** Adota os .xml de sessões efêmeras recém-usadas na geração do pacote —
 * cópia server-side, sem re-upload. Chamado no fluxo de criação do estudo. */
export async function adotarFontesDeSessao(
  estudoId: string,
  sessionIds: string[],
): Promise<{ fontes: unknown[]; erros: unknown[]; index_status: IndexStatus }> {
  const res = await authFetch(`${BASE_URL}/estudos/${estudoId}/fontes/from-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_ids: sessionIds }),
  });
  return jsonOrThrow(res);
}

export async function removerFonteXml(
  estudoId: string,
  fonteId: string,
): Promise<{ removida: string; n_fontes: number; index_status: IndexStatus }> {
  const res = await authFetch(
    `${BASE_URL}/estudos/${estudoId}/fontes/${encodeURIComponent(fonteId)}`,
    { method: "DELETE" },
  );
  return jsonOrThrow(res);
}

export async function reindexarFontes(
  estudoId: string,
): Promise<{ index_status: IndexStatus }> {
  const res = await authFetch(`${BASE_URL}/estudos/${estudoId}/fontes/reindex`, {
    method: "POST",
  });
  return jsonOrThrow(res);
}
