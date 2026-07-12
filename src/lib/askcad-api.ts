// APP-LOCAL — não adicionar ao sync-from-hub.
//
// Port adaptado do cliente do AskCAD do manta-hub, reduzido ao que o painel
// de assistente do dashboard usa: bootstrap from-peer, chat SSE e resposta de
// formulário. A versão do hub importa `cad-engine/types` (inexistente aqui) e
// carrega upload/geometria/PDF — nada disso se aplica a este app.
//
// Roteamento: em DEV o vite proxy resolve `/api/askcad` → mantaapi/askcad/api
// (same-origin). Em PROD o Netlify NÃO serve para SSE (timeout ~30s +
// buffering), então o build define VITE_ASKCAD_API_URL apontando direto para
// mantaapi (cross-origin com CORS liberado no backend askcad; auth é Bearer).
import { authFetch, getAuthDownloadUrl } from "./api-client";
import { ensureFreshToken, getAccessToken, refreshToken } from "./auth";

const BASE_URL = import.meta.env.VITE_ASKCAD_API_URL || "/api/askcad";

/* ── Types ─────────────────────────────────────────────────── */

export type AgentEventKind =
  | "start"
  | "thinking"
  | "text"
  | "tool_call"
  | "tool_result"
  | "proposal"
  | "skill_draft"
  | "persona_draft"
  | "form_request"
  | "memory_added"
  | "turn_end"
  | "stop"
  | "error";

export interface AgentEvent {
  kind: AgentEventKind;
  turn: number;
  data: Record<string, unknown>;
}

export type PeerService =
  | "paisagismo"
  | "iluminacao"
  | "pavimentacao"
  | "terraplenagem"
  | "sinalizacao"
  | "balanco"
  | "landxml"
  | "landxml_dashboard";

export interface FormFieldSchema {
  name: string;
  label: string;
  type: "number" | "integer" | "string" | "select" | "boolean";
  default?: unknown;
  options?: string[];
  min?: number;
  max?: number;
  unit?: string;
  hint?: string;
  required?: boolean;
}

export interface FromPeerRequest {
  service: PeerService;
  peer_session_id: string;
  peer_filename?: string;
  peer_candidates?: Record<string, unknown>;
  peer_summary?: Record<string, unknown>;
  title?: string | null;
  /** Persona aplicada na criação (ex.: "askterra"). Slug inválido é ignorado. */
  persona_slug?: string;
}

export interface FromPeerResponse {
  session_id: string;
  filename: string;
  title?: string | null;
  summary: Record<string, unknown>;
  service_context: { service: string; peer_session_id: string };
  warnings: string[];
}

/* ── API Functions ─────────────────────────────────────────── */

export async function createAskCadFromPeer(
  req: FromPeerRequest,
): Promise<FromPeerResponse> {
  const res = await authFetch(`${BASE_URL}/from-peer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`from-peer ${res.status}: ${body}`);
  }
  return res.json();
}

/**
 * Streams agent events from the server. Yields each event as parsed.
 * Aborts on signal cancellation.
 */
export async function* streamChat(
  sessionId: string,
  question: string,
  model?: string,
  signal?: AbortSignal,
): AsyncGenerator<AgentEvent, void, unknown> {
  // SSE streams cannot retry after .getReader() starts, so refresh the token
  // ahead of time if it's close to expiring.
  await ensureFreshToken(60);

  const body: Record<string, unknown> = { question, model };
  yield* streamSse(`${BASE_URL}/chat/${sessionId}`, body, signal);
}

/**
 * Submit a form filled by the user (in response to a `form_request` event).
 * Streams the agent's continuation as SSE — same wire format as streamChat.
 */
export async function* submitFormResponse(
  sessionId: string,
  formId: string,
  values: Record<string, unknown>,
  cancelled = false,
  signal?: AbortSignal,
): AsyncGenerator<AgentEvent, void, unknown> {
  await ensureFreshToken(60);
  const body = { form_id: formId, values, cancelled };
  yield* streamSse(`${BASE_URL}/chat/${sessionId}/form-response`, body, signal);
}

async function* streamSse(
  url: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): AsyncGenerator<AgentEvent, void, unknown> {
  const openStream = async (): Promise<Response> => {
    const token = getAccessToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal,
    });
  };

  let res = await openStream();
  if (res.status === 401) {
    // Token expired between the refresh check and the fetch. Try one more
    // refresh + retry before giving up.
    const refreshed = await refreshToken();
    if (refreshed) {
      res = await openStream();
    }
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Chat error ${res.status}: ${text}`);
  }
  if (!res.body) throw new Error("Response has no body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sepIndex: number;
      while ((sepIndex = buffer.indexOf("\n\n")) !== -1) {
        const rawEvent = buffer.slice(0, sepIndex);
        buffer = buffer.slice(sepIndex + 2);
        const event = parseSseBlock(rawEvent);
        if (event) yield event;
      }
    }
    if (buffer.trim().length > 0) {
      const event = parseSseBlock(buffer);
      if (event) yield event;
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* ignore */
    }
  }
}

export function parseSseBlock(block: string): AgentEvent | null {
  const lines = block.split("\n");
  const dataLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }
  if (dataLines.length === 0) return null;
  try {
    return JSON.parse(dataLines.join("\n"));
  } catch {
    return null;
  }
}

/**
 * Build a downloadable URL for an artifact produced by export_to_excel /
 * export_to_json. The backend returns `download_path` relative to the askcad
 * API base (e.g. "/artifacts/<sid>/<aid>"); stitch BASE_URL + auth token.
 */
export function getArtifactDownloadUrl(downloadPath: string): string {
  const sep = downloadPath.startsWith("/") ? "" : "/";
  return getAuthDownloadUrl(`${BASE_URL}${sep}${downloadPath}`);
}
