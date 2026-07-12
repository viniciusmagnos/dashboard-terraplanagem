/**
 * Cliente OAuth 2.1 (Authorization Code + PKCE) para o SSO "Entrar com Manta
 * Hub". O Authorization Server é o serviço auth do Manta Hub (issuer
 * https://hub.mantaassociados.com), o mesmo usado pelo conector MCP.
 *
 * Fluxo:
 *  1) beginLogin(): gera PKCE verifier/challenge + state, guarda em
 *     sessionStorage e faz REDIRECT de página inteira para /v1/oauth/authorize
 *     (navegação top-level → sem CORS). O hub mostra a tela de consentimento
 *     reaproveitando a sessão do usuário no hub (o ganho de SSO).
 *  2) hub redireciona de volta para {origin}/callback?code=...&state=...
 *  3) exchangeCode(): troca o code (+verifier) por tokens em POST /oauth/token
 *     (same-origin via proxy → sem CORS). Devolve access + refresh.
 *  4) refreshOAuth(): renova via grant_type=refresh_token (rotação no servidor).
 *
 * O access token é um JWT assinado com o JWT_SECRET compartilhado → aceito por
 * toda a API do hub (landxml/sondagem/auth). O user é obtido depois via
 * GET /auth/api/me (o token endpoint não devolve o usuário).
 */

const ISSUER = (import.meta.env.VITE_OAUTH_ISSUER as string) ||
  "https://hub.mantaassociados.com";
const CLIENT_ID = (import.meta.env.VITE_OAUTH_CLIENT_ID as string) ||
  "dashboard-terraplenagem";

// authorize é navegação top-level → precisa da URL ABSOLUTA do hub (a sessão/
// cookies de consentimento vivem no domínio do hub).
const AUTHORIZE_URL = `${ISSUER}/v1/oauth/authorize`;
// token é fetch → usamos o proxy same-origin (/oauth/token → hub/v1/oauth/token)
// para não depender de CORS.
const TOKEN_URL = "/oauth/token";

const VERIFIER_KEY = "manta-oauth-verifier";
const STATE_KEY = "manta-oauth-state";
const RETURN_KEY = "manta-oauth-return";

export interface OAuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
}

function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomString(len = 64): string {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return base64url(arr).slice(0, len);
}

async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return base64url(new Uint8Array(digest));
}

export function redirectUri(): string {
  return `${window.location.origin}/callback`;
}

/** Inicia o login: redireciona o browser inteiro para o hub. */
export async function beginLogin(returnTo?: string): Promise<void> {
  const verifier = randomString(64);
  const state = randomString(32);
  const challenge = await pkceChallenge(verifier);
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);
  if (returnTo) sessionStorage.setItem(RETURN_KEY, returnTo);

  const p = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: redirectUri(),
    code_challenge: challenge,
    code_challenge_method: "S256",
    scope: "mcp",
    state,
  });
  window.location.href = `${AUTHORIZE_URL}?${p.toString()}`;
}

/** Troca o authorization code por tokens. Valida o state (CSRF). */
export async function exchangeCode(
  code: string,
  state: string,
): Promise<OAuthTokens> {
  const expectedState = sessionStorage.getItem(STATE_KEY);
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  if (!expectedState || state !== expectedState) {
    throw new Error("OAuth: state inválido (possível CSRF).");
  }
  if (!verifier) {
    throw new Error("OAuth: code_verifier ausente (recomece o login).");
  }
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(),
    client_id: CLIENT_ID,
    code_verifier: verifier,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  sessionStorage.removeItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OAuth token: ${res.status} — ${txt}`);
  }
  const json = await res.json();
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_in: json.expires_in,
  };
}

/** Renova os tokens (rotação de refresh no servidor). */
export async function refreshOAuth(refreshTokenValue: string): Promise<OAuthTokens> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshTokenValue,
    client_id: CLIENT_ID,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`OAuth refresh: ${res.status}`);
  const json = await res.json();
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_in: json.expires_in,
  };
}

/** Lê e limpa o destino pós-login (deep-link preservado). */
export function takeReturnTo(): string | null {
  const v = sessionStorage.getItem(RETURN_KEY);
  if (v) sessionStorage.removeItem(RETURN_KEY);
  return v;
}
