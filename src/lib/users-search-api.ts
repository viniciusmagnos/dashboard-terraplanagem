/**
 * Thin client for the auth backend's user directory endpoints.
 *
 * Used by the chat-sharing dialog (ShareDialog.tsx) to find colleagues by
 * username and to enrich the participants list with display names.
 */

import { authFetch } from "./api-client";

const BASE_URL = import.meta.env.VITE_AUTH_API_URL || "/api/auth";

export interface DirectoryUser {
  id: number;
  username: string;
  display_name: string;
  role: string;
}

/**
 * Search active users by username or display_name. Empty query returns the
 * first ``limit`` users alphabetically — useful as the initial dropdown
 * content so the share dialog doesn't look empty on focus.
 */
export async function searchUsers(query: string, limit = 20): Promise<DirectoryUser[]> {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  params.set("limit", String(limit));
  const res = await authFetch(`${BASE_URL}/users/search?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Falha ao buscar usuários (${res.status}).`);
  }
  return res.json();
}

/**
 * Batch resolve user IDs to display info. The participants endpoint in
 * AskCAD returns ``user_id`` only; this is how the UI fills the chips.
 */
export async function getUsersByIds(ids: number[]): Promise<DirectoryUser[]> {
  const cleaned = Array.from(new Set(ids.filter((n) => Number.isFinite(n) && n > 0)));
  if (cleaned.length === 0) return [];
  const params = new URLSearchParams({ ids: cleaned.join(",") });
  const res = await authFetch(`${BASE_URL}/users?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Falha ao resolver IDs de usuário (${res.status}).`);
  }
  return res.json();
}
