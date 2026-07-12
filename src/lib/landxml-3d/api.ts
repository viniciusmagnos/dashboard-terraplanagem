import { authFetch } from "../api-client";
import type { LandXmlSceneData } from "./types";

/** Fetch a Three.js-ready scene payload for a session.
 *
 * ``baseUrl`` should be the backend prefix (mantacad or askcad). The endpoint
 * is ``GET {baseUrl}/scene-3d/{sessionId}?lod=...``.
 */
export async function getScene3d(
  baseUrl: string,
  sessionId: string,
  options?: { lod?: "low" | "medium" | "full"; includeAlignments?: boolean },
): Promise<LandXmlSceneData> {
  const qs = new URLSearchParams();
  if (options?.lod) qs.set("lod", options.lod);
  if (options?.includeAlignments === false) qs.set("include_alignments", "false");
  const url = qs.toString()
    ? `${baseUrl}/scene-3d/${sessionId}?${qs.toString()}`
    : `${baseUrl}/scene-3d/${sessionId}`;
  const res = await authFetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Scene-3D error ${res.status}: ${body}`);
  }
  return res.json();
}
