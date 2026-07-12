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
