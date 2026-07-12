/**
 * API client for the auth service.
 * These functions do NOT use authFetch (they run before/during auth).
 */

const BASE_URL = import.meta.env.VITE_AUTH_API_URL || "/api/auth";

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: {
    id: number;
    username: string;
    display_name: string;
    role: string;
  };
}

export interface RecentProject {
  id: number;
  tool: string;
  filename: string;
  session_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface UserPreferences {
  theme: string;
  preferences_json: Record<string, unknown>;
}

// ── Auth (no token needed) ───────────────────────────────────

export async function loginRequest(
  username: string,
  password: string
): Promise<TokenResponse> {
  const res = await fetch(`${BASE_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `Login failed (${res.status})`);
  }
  return res.json();
}

export async function refreshTokens(
  refreshToken: string
): Promise<TokenResponse> {
  const res = await fetch(`${BASE_URL}/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) throw new Error("Refresh failed");
  return res.json();
}

export async function logoutRequest(
  accessToken: string,
  refreshToken: string
): Promise<void> {
  await fetch(`${BASE_URL}/logout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}

// ── User data (needs authFetch — imported lazily to avoid circular deps) ──

async function authFetchJson<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const { authFetch } = await import("./api-client");
  const res = await authFetch(`${BASE_URL}${path}`, options);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `API error ${res.status}`);
  }
  return res.json();
}

export async function getMe() {
  return authFetchJson<TokenResponse["user"]>("/me");
}

export async function getPreferences() {
  return authFetchJson<UserPreferences>("/me/preferences");
}

export async function updatePreferences(prefs: {
  theme?: string;
  preferences_json?: Record<string, unknown>;
}) {
  return authFetchJson<UserPreferences>("/me/preferences", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(prefs),
  });
}

export async function changePassword(currentPassword: string, newPassword: string) {
  return authFetchJson<{ detail: string }>("/me/password", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  });
}

export async function getRecentProjects(limit = 20, tool?: string) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (tool) params.set("tool", tool);
  return authFetchJson<RecentProject[]>(
    `/me/recent-projects?${params.toString()}`
  );
}

export async function addRecentProject(data: {
  tool: string;
  filename: string;
  session_id?: string;
  metadata?: Record<string, unknown>;
}) {
  return authFetchJson<RecentProject>("/me/recent-projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

// ── OAuth 2.1 consent (MCP connector authorization) ──────────────

export interface OAuthConsentDetail {
  client_name: string;
  scopes: string[];
}

export async function getOAuthConsentDetail(requestId: string) {
  return authFetchJson<OAuthConsentDetail>(
    `/oauth/authorize/${encodeURIComponent(requestId)}`
  );
}

export async function approveOAuth(requestId: string) {
  return authFetchJson<{ redirect_uri: string }>(
    `/oauth/authorize/${encodeURIComponent(requestId)}/approve`,
    { method: "POST" }
  );
}

export async function denyOAuth(requestId: string) {
  return authFetchJson<{ redirect_uri: string }>(
    `/oauth/authorize/${encodeURIComponent(requestId)}/deny`,
    { method: "POST" }
  );
}
