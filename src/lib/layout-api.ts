// APP-LOCAL — não adicionar ao sync-from-hub.
//
// Client dos endpoints de LAYOUT dinâmico (/api/estudos/{id}/layout*).
// O layout tem rev PRÓPRIO (layout_rev), separado do estado — mutações do
// assistente não disputam o rev do push debounced do usuário. O frontend só
// usa leitura + remoções granulares + reset; upserts são feitos pelo agente
// (tools dashboard_*) e via MCP.
import { authFetch } from "./api-client";

const BASE_URL = import.meta.env.VITE_LANDXML_API_URL || "/api/landxml";

export interface LayoutResponse {
  changed: boolean;
  layout_rev: number;
  /** Presente quando changed=true. */
  spec?: unknown;
}

export interface LayoutMutResponse {
  layout_rev: number;
  n_abas: number;
  n_blocos: number;
  n_overlays: number;
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

export async function obterLayout(
  estudoId: string,
  sinceRev?: number,
): Promise<LayoutResponse> {
  const qs = sinceRev != null ? `?since_rev=${sinceRev}` : "";
  const res = await authFetch(`${BASE_URL}/estudos/${estudoId}/layout${qs}`);
  return jsonOrThrow(res);
}

export async function removerBlocoLayout(
  estudoId: string,
  blocoId: string,
): Promise<LayoutMutResponse> {
  const res = await authFetch(
    `${BASE_URL}/estudos/${estudoId}/layout/blocos/${encodeURIComponent(blocoId)}`,
    { method: "DELETE" },
  );
  return jsonOrThrow(res);
}

export async function removerSerieLayout(
  estudoId: string,
  grafico: string,
  serieId: string,
): Promise<LayoutMutResponse> {
  const res = await authFetch(
    `${BASE_URL}/estudos/${estudoId}/layout/series/${encodeURIComponent(grafico)}/${encodeURIComponent(serieId)}`,
    { method: "DELETE" },
  );
  return jsonOrThrow(res);
}

export async function removerAbaLayout(
  estudoId: string,
  abaId: string,
  force = false,
): Promise<LayoutMutResponse> {
  const qs = force ? "?force=true" : "";
  const res = await authFetch(
    `${BASE_URL}/estudos/${estudoId}/layout/abas/${encodeURIComponent(abaId)}${qs}`,
    { method: "DELETE" },
  );
  return jsonOrThrow(res);
}

export async function resetLayout(
  estudoId: string,
  escopo: "tudo" | "overlays" | `aba:${string}` = "tudo",
): Promise<LayoutMutResponse> {
  const res = await authFetch(`${BASE_URL}/estudos/${estudoId}/layout/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ escopo }),
  });
  return jsonOrThrow(res);
}
