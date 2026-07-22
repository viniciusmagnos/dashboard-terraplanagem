/**
 * Centralized fetch wrapper with JWT auth header injection.
 *
 * - Injects Authorization: Bearer header on every request
 * - Intercepts 401 responses and attempts silent token refresh
 * - On refresh failure, redirects to /login
 */

import { getAccessToken, refreshToken, clearAuth } from "./auth";

let refreshPromise: Promise<boolean> | null = null;

/**
 * fetch() wrapper that adds the JWT auth header and handles 401 refresh.
 */
export async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getAccessToken();
  const headers = new Headers(options.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Bypass the HTTP disk cache for API calls. Browsers heuristically cache
  // 410 Gone (and other status codes without explicit Cache-Control) for
  // long periods per RFC 9111; once a stale 410 lands in the cache, every
  // subsequent request is served locally and never hits the backend — which
  // produces a "session won't reopen after backend restart" bug even after
  // the backend itself is fixed. ``cache: "no-store"`` makes the browser
  // refuse to use any cached entry and refuse to write a new one.
  const fetchOpts: RequestInit = {
    ...options,
    headers,
    cache: options.cache ?? "no-store",
  };

  let res = await fetch(url, fetchOpts);

  if (res.status === 401 && token) {
    // Deduplicate concurrent refresh attempts
    if (!refreshPromise) {
      refreshPromise = refreshToken().finally(() => {
        refreshPromise = null;
      });
    }
    const refreshed = await refreshPromise;

    if (refreshed) {
      // Retry with the new token
      const retryHeaders = new Headers(options.headers);
      retryHeaders.set("Authorization", `Bearer ${getAccessToken()}`);
      res = await fetch(url, { ...fetchOpts, headers: retryHeaders });
    } else {
      clearAuth();
      window.location.href = "/login";
    }
  }

  return res;
}

/**
 * authFetch + JSON parse + error handling.
 */
export async function authRequest<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await authFetch(url, options);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return res.json();
}

export interface UploadProgress {
  /** Bytes uploaded so far. */
  loaded: number;
  /** Total bytes to upload (0 when not computable). */
  total: number;
  /** 0–100, or -1 when the total length is not computable. */
  percent: number;
}

export interface XhrUploadOptions {
  /** Fired repeatedly as the request body is uploaded. */
  onUploadProgress?: (p: UploadProgress) => void;
  /**
   * Fired once — the moment the request body finishes uploading. After this the
   * server is processing (e.g. converting DWG→DXF), which XHR can't measure, so
   * the caller should switch to an indeterminate "processing" indicator.
   */
  onUploadComplete?: () => void;
}

/**
 * Multipart POST via XMLHttpRequest so the caller can track real upload
 * progress (fetch() exposes no upload progress). Mirrors authFetch's auth:
 * injects the Bearer token and, on a 401, refreshes once and retries.
 *
 * Note: a 401 retry re-sends the whole body. Access tokens last 30 min so this
 * is rare in practice, and it matches authFetch's retry semantics.
 */
export function xhrUpload<T = unknown>(
  url: string,
  form: FormData,
  opts: XhrUploadOptions = {},
): Promise<T> {
  const send = (token: string | null): Promise<{ status: number; body: string }> =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url, true);
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

      xhr.upload.onprogress = (e: ProgressEvent) => {
        if (!opts.onUploadProgress) return;
        const total = e.lengthComputable ? e.total : 0;
        const percent =
          e.lengthComputable && total > 0
            ? Math.round((e.loaded / total) * 100)
            : -1;
        opts.onUploadProgress({ loaded: e.loaded, total, percent });
      };
      let completeFired = false;
      const fireComplete = () => {
        if (!completeFired) {
          completeFired = true;
          opts.onUploadComplete?.();
        }
      };
      xhr.upload.onload = fireComplete;

      xhr.onload = () => {
        fireComplete();
        resolve({ status: xhr.status, body: xhr.responseText });
      };
      xhr.onerror = () => reject(new Error("Erro de rede durante o upload."));
      xhr.onabort = () => reject(new Error("Upload cancelado."));
      xhr.ontimeout = () => reject(new Error("Tempo de upload esgotado."));
      xhr.send(form);
    });

  return (async () => {
    const token = getAccessToken();
    let { status, body } = await send(token);

    if (status === 401 && token) {
      if (!refreshPromise) {
        refreshPromise = refreshToken().finally(() => {
          refreshPromise = null;
        });
      }
      const refreshed = await refreshPromise;
      if (refreshed) {
        ({ status, body } = await send(getAccessToken()));
      } else {
        clearAuth();
        window.location.href = "/login";
        throw new Error("Sessão expirada.");
      }
    }

    if (status < 200 || status >= 300) {
      throw new Error(`${status}: ${body}`);
    }
    return (body ? JSON.parse(body) : undefined) as T;
  })();
}

/**
 * For download URLs that use <a href> or window.open (cannot send headers).
 * Appends ?token= query param with the current access token.
 */
export function getAuthDownloadUrl(baseUrl: string): string {
  const token = getAccessToken();
  if (!token) return baseUrl;
  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}token=${token}`;
}
