/**
 * Estado de sessão do dashboard (SSO com o Manta Hub via OAuth 2.1 + PKCE).
 *
 * - Access token (JWT) em memória (nunca em localStorage).
 * - Refresh token em localStorage (mesma chave do hub: "manta-auth-refresh").
 * - User em localStorage para evitar flash no reload.
 * - useSyncExternalStore para reatividade no React.
 *
 * A aquisição inicial dos tokens é feita pelo fluxo OAuth (src/lib/oauth.ts,
 * usado pela LoginPage/CallbackPage). Aqui ficam o store e a renovação
 * silenciosa (grant_type=refresh_token), consumida pelo authFetch no 401.
 */

import { refreshOAuth } from "./oauth";
import { getMe } from "./auth-api";
import { useSyncExternalStore } from "react";

export interface User {
  id: number;
  username: string;
  display_name: string;
  role: string;
}

interface AuthState {
  accessToken: string | null;
  user: User | null;
}

const REFRESH_KEY = "manta-auth-refresh";
const USER_KEY = "manta-auth-user";

let state: AuthState = {
  accessToken: null,
  user: loadUserFromStorage(),
};

const listeners = new Set<() => void>();

function loadUserFromStorage(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function notify() {
  listeners.forEach((fn) => fn());
}

// ── Getters ──────────────────────────────────────────────────
export function getAccessToken(): string | null {
  return state.accessToken;
}
export function getUser(): User | null {
  return state.user;
}
export function isAuthenticated(): boolean {
  return state.accessToken !== null;
}

// ── Mutations ────────────────────────────────────────────────
/** Grava tokens preservando o user atual (usado no refresh). */
export function setTokens(accessToken: string, refreshTokenValue: string) {
  state = { ...state, accessToken };
  localStorage.setItem(REFRESH_KEY, refreshTokenValue);
  notify();
}

export function setUser(user: User) {
  state = { ...state, user };
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  notify();
}

export function clearAuth() {
  state = { accessToken: null, user: null };
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
  notify();
}

// ── Fluxo OAuth ──────────────────────────────────────────────
/** Chamado pela CallbackPage após trocar o code por tokens. */
export async function finishOAuthLogin(tokens: {
  access_token: string;
  refresh_token: string;
}): Promise<void> {
  setTokens(tokens.access_token, tokens.refresh_token);
  try {
    setUser(await getMe());
  } catch {
    // segue autenticado mesmo sem os dados do perfil (o token é válido)
  }
}

export async function logout(): Promise<void> {
  clearAuth();
}

/** Renovação silenciosa (consumida pelo authFetch no 401). */
export async function refreshToken(): Promise<boolean> {
  const stored = localStorage.getItem(REFRESH_KEY);
  if (!stored) return false;
  try {
    const t = await refreshOAuth(stored);
    setTokens(t.access_token, t.refresh_token);
    if (!state.user) {
      try {
        setUser(await getMe());
      } catch {
        /* opcional */
      }
    }
    return true;
  } catch {
    clearAuth();
    return false;
  }
}

function decodeJwtExp(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

/** Garante token válido por pelo menos `bufferSeconds` (streams longos). */
export async function ensureFreshToken(bufferSeconds = 60): Promise<void> {
  const token = state.accessToken;
  if (!token) return;
  const exp = decodeJwtExp(token);
  if (exp === null) return;
  const nowSec = Math.floor(Date.now() / 1000);
  if (exp - nowSec >= bufferSeconds) return;
  await refreshToken();
}

/** Restaura a sessão no boot usando o refresh token guardado. */
export async function initAuth(): Promise<boolean> {
  const stored = localStorage.getItem(REFRESH_KEY);
  if (!stored) {
    state = { accessToken: null, user: null };
    return false;
  }
  return refreshToken();
}

// ── React hook ───────────────────────────────────────────────
function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}
function getSnapshot(): AuthState {
  return state;
}

export function useAuth() {
  const s = useSyncExternalStore(subscribe, getSnapshot);
  return {
    user: s.user,
    isAuthenticated: s.accessToken !== null,
    accessToken: s.accessToken,
  };
}
