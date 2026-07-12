/**
 * Import de sondagens em um estudo JÁ EXISTENTE (aba Geotecnia).
 *
 * Chama o endpoint POST /api/estudos/{id}/sondagens (adicionado ao backend
 * landxml): ele carrega o .mtp.json do estudo, projeta os laudos nas polilinhas
 * dos eixos (geometria.eixos[].tracado) e mescla/substitui o bloco `sondagens`,
 * bumpando o rev. Assim dá para "importar a geometria e, depois, as sondagens"
 * — inclusive vindas de outra ferramenta do Manta Hub.
 */
import { authFetch } from "./api-client";
import type { SondagemReport } from "./sondagem-api";

const BASE_URL = import.meta.env.VITE_LANDXML_API_URL || "/api/landxml";

/** Formato "laudo" cru esperado pelo backend (saída do extract_sondagens.py). */
export interface LaudoSondagem {
  id: string;
  tipo: string;
  arquivo?: string;
  norte: number | null;
  este: number | null;
  cota_m: number | null;
  prof_total_m: number | null;
  na: { depth_m: number | null; note?: string | null }[];
  camadas: {
    de_m: number;
    a_m: number;
    n_spt: number | null;
    material: string;
  }[];
  confianca?: number;
}

export interface ImportSondagensResult {
  estudo_id: string;
  rev: number;
  n_total: number;
  n_posicionadas: number;
  warnings: string[];
}

export async function importarSondagensEstudo(
  estudoId: string,
  sondagens: LaudoSondagem[],
  opts?: { replace?: boolean; maxOffset?: number; excludeEixos?: string[] },
): Promise<ImportSondagensResult> {
  const res = await authFetch(`${BASE_URL}/estudos/${estudoId}/sondagens`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sondagens,
      replace: opts?.replace ?? false,
      sondagens_max_offset: opts?.maxOffset ?? 150.0,
      exclude_eixos: opts?.excludeEixos ?? [],
    }),
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const b = await res.json();
      detail = typeof b?.detail === "string" ? b.detail : JSON.stringify(b?.detail ?? b);
    } catch {
      /* usa statusText */
    }
    throw new Error(`Importar sondagens: ${res.status} — ${detail}`);
  }
  return res.json();
}

/** Converte um SondagemReport (serviço sondagem 8013) no formato "laudo". */
export function reportParaLaudo(r: SondagemReport): LaudoSondagem {
  const conf = Object.values(r.confidence ?? {});
  const confMedia =
    conf.length > 0 ? conf.reduce((a, c) => a + (c.value ?? 0), 0) / conf.length : undefined;
  return {
    id: r.metadata?.sondagem_number || r.report_id || r.source_filename,
    tipo: r.sondagem_type,
    arquivo: r.source_filename,
    norte: r.coordinates?.norte ?? null,
    este: r.coordinates?.este ?? null,
    cota_m: r.coordinates?.cota_m ?? null,
    prof_total_m: r.profundidade_total_m ?? null,
    na: (r.water_levels ?? []).map((w) => ({ depth_m: w.depth_m, note: w.note })),
    camadas: (r.layers ?? []).map((l) => ({
      de_m: l.depth_start,
      a_m: l.depth_end,
      n_spt: l.n_value,
      material: l.material,
    })),
    confianca: confMedia,
  };
}
